import { ExtraAnswers } from "@/components/extra-answers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import {
  ParentRegistrationReview,
  type ParentSubmission,
} from "@/components/children/registration-review";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, t] = await Promise.all([
    serverGet<ParentSubmission>(
      `/children/registrations/${encodeURIComponent(id)}`,
    ),
    getTranslations("childrenRecords"),
  ]);
  return (
    <>
      <Link
        className="kids-chip"
        href={`/children/registrations?branchId=${row.branchId}`}
      >
        {t("back.queue")}
      </Link>
      <ExtraAnswers answers={row.customAnswers} />
      {row.children.map((child, index) => <ExtraAnswers key={index} answers={child.customAnswers} />)}
      <ParentRegistrationReview key={row.revision} row={row} />
    </>
  );
}
