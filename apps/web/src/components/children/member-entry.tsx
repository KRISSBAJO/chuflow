import Link from "next/link";
import { getTranslations } from "next-intl/server";
export async function ChildMemberEntry({ role }: { role: string }) {
  if (
    ![
      "super_admin",
      "national_admin",
      "district_admin",
      "branch_admin",
      "resident_pastor",
    ].includes(role)
  )
    return null;
  const t = await getTranslations("childrenRecords");
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e9d9b5] bg-[#fff8e9] p-5">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffdda4] text-xl"
          aria-hidden="true"
        >
          🧒
        </span>
        <div>
          <h2 className="text-base font-semibold">{t("memberEntry.title")}</h2>
          <p className="mt-1 text-sm text-[#6d705c]">{t("memberEntry.body")}</p>
        </div>
      </div>
      <Link
        href="/children/families/new"
        className="inline-flex shrink-0 items-center rounded-xl bg-[#285c49] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d4b3d]"
      >
        {t("memberEntry.cta")}
      </Link>
    </section>
  );
}
