import Link from "next/link";
export function ChildMemberEntry({ role }: { role: string }) {
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
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e9d9b5] bg-[#fff8e9] p-5">
      <div>
        <h2 className="text-base font-semibold">Registering a child?</h2>
        <p className="mt-1 text-sm text-[#6d705c]">
          Use the children’s workspace to link a guardian and set pickup
          permissions. The child can also appear in Members.
        </p>
      </div>
      <Link
        href="/children/families/new"
        className="inline-flex shrink-0 items-center rounded-xl bg-[#285c49] px-4 py-3 text-sm font-semibold text-white"
      >
        Register child & guardian →
      </Link>
    </section>
  );
}
