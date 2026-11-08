import { ExtraAnswers } from "@/components/extra-answers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { ChildForm } from "@/components/children/forms";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; childId: string }>;
}) {
  const { id, childId } = await params;
  const [family, t] = await Promise.all([
    serverGet<Family>(`/children/families/${encodeURIComponent(id)}`),
    getTranslations("childrenRecords"),
  ]);
  const child = family.children.find((c) => c._id === childId);
  if (!child) notFound();
  return (
    <>
      <Link href={`/children/families/${id}`} className="kids-chip">
        {t("back.family")}
      </Link>
      <ExtraAnswers answers={child.customAnswers} />
      <ChildForm family={family} child={child} />
    </>
  );
}
