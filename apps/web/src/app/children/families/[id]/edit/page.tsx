import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { FamilyForm } from "@/components/children/forms";
import type { Family, ChildrenOptions } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [family, options, t] = await Promise.all([
    serverGet<Family>(`/children/families/${encodeURIComponent(id)}`),
    serverGet<ChildrenOptions>("/children/options"),
    getTranslations("childrenRecords"),
  ]);
  return (
    <>
      <Link href={`/children/families/${id}`} className="kids-chip">
        {t("back.family")}
      </Link>
      <FamilyForm family={family} options={options} />
    </>
  );
}
