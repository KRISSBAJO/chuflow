import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { ChildrenSessionConsole } from "@/components/children/session-console";
import type { ChildSession } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, t] = await Promise.all([
    serverGet<ChildSession>(`/children/sessions/${encodeURIComponent(id)}`),
    getTranslations("childrenDesk.common"),
  ]);
  return (
    <>
      <Link
        href="/children"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#245b4b] underline-offset-4 hover:underline"
      >
        ← {t("backToWorkspace")}
      </Link>
      <Suspense fallback={<p className="children-muted">{t("loading")}</p>}>
        <ChildrenSessionConsole initial={data} />
      </Suspense>
    </>
  );
}
