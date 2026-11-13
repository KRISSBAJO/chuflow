import { getServerSessionUser } from "@/lib/auth";
import { IMPORT_MAX_FILE, parseImportFile } from "@/lib/import-parser";
import { LEADERSHIP_ROLES } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await getServerSessionUser();
  if (!user || !LEADERSHIP_ROLES.includes(user.role as never)) return new Response(null, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (length > IMPORT_MAX_FILE + 65536) return new Response(null, { status: 413 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size > IMPORT_MAX_FILE) return new Response(null, { status: 400 });
    const sheets = await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name);
    return Response.json(sheets, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response(null, { status: 400 });
  }
}
