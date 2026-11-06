import Link from "next/link";
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
  const row = await serverGet<ParentSubmission>(
    `/children/registrations/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <Link
        className="text-sm"
        href={`/children/registrations?branchId=${row.branchId}`}
      >
        ← Back to registration queue
      </Link>
      <ParentRegistrationReview key={row.revision} row={row} />
    </>
  );
}
