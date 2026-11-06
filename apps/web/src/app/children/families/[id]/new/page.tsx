import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { ChildForm } from "@/components/children/forms";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [family, t] = await Promise.all([
    serverGet<Family>(`/children/families/${encodeURIComponent(id)}`),
    getTranslations("childrenRecords"),
  ]);
  return (
    <>
      <Link href={`/children/families/${id}`} className="kids-chip">
        {t("back.family")}
      </Link>
      <ChildForm family={family} />
    </>
  );
}
