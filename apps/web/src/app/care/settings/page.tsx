import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/ui";
import { CarePlanForm } from "@/components/care/care-plan-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { CarePlan, CareOptions } from "@/lib/care";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  await requireServerRole("/care");
  const [t, tHub] = await Promise.all([getTranslations("people.care.settings"), getTranslations("people.care.hub")]);
  const options = await serverGet<CareOptions>("/care/options");
  if (!options.isAdmin) redirect("/care");
  const params = await searchParams;
  const branchId = options.branches.some((b) => b._id === params.branchId)
    ? params.branchId
    : options.branches[0]?._id;
  const plan = branchId
    ? await serverGet<CarePlan>("/care/plans/" + branchId)
    : null;
  return (
    <Shell>
      <div>
        <Link className={buttonClass("ghost", "sm")} href="/care">
          ← {tHub("careHub")}
        </Link>
      </div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <form className="flex gap-3">
        <select
          className="ui-input max-w-md"
          name="branchId"
          defaultValue={branchId}
        >
          {options.branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>{t("chooseBranch")}</button>
      </form>
      {plan && branchId && (
        <CarePlanForm key={branchId} plan={plan} branchId={branchId} />
      )}
    </Shell>
  );
}
