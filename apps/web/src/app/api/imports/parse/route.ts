import { getServerSessionUser } from "@/lib/auth";
import { LEADERSHIP_ROLES } from "@/lib/permissions";
import { IMPORT_MAX_FILE, parseImportFile } from "@/lib/import-parser";
export const runtime = "nodejs";
export const maxDuration = 60;
let reading = false;
export async function POST(request: Request) {
  const user = await getServerSessionUser().catch(() => null);
  if (!user || !LEADERSHIP_ROLES.includes(user.role as never))
    return Response.json(
      { message: "Church leadership access is required." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > IMPORT_MAX_FILE + 20000)
    return Response.json(
      { message: "Choose a file smaller than 8 MB." },
      { status: 413 },
    );
  if (reading)
    return Response.json(
      {
        message: "Another spreadsheet is being read. Please try again shortly.",
      },
      { status: 429 },
    );
  reading = true;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose a spreadsheet.");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > IMPORT_MAX_FILE + 20000) {
        await reader.cancel();
        return Response.json(
          { message: "Choose a file smaller than 8 MB." },
          { status: 413 },
        );
      }
      chunks.push(result.value);
    }
    const body = new Uint8Array(Buffer.concat(chunks));
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > IMPORT_MAX_FILE)
      throw new Error("Choose an Excel or CSV file smaller than 8 MB.");
    return Response.json(
      {
        sheets: await parseImportFile(
          Buffer.from(await file.arrayBuffer()),
          file.name,
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        message:
          e instanceof Error ? e.message : "Could not read this spreadsheet.",
      },
      { status: 400 },
    );
  } finally {
    reading = false;
  }
}
