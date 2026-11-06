import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { initials } from "@/components/children/records-utils";
export default async function Page() {
  const [u, t] = await Promise.all([
    requireServerRole("/children/account"),
    getTranslations("childrenRecords"),
  ]);
  const roleLabel =
    u.role === "children_worker" || u.role === "children_supervisor"
      ? t(`account.roles.${u.role}`)
      : t("account.roles.other");
  return (
    <div className="space-y-6 kids-fade-in">
      <Link href="/children" className="kids-chip">
        {t("back.workspace")}
      </Link>
      <div className="kids-split">
        <section className="children-panel">
          <p className="children-kicker">{t("account.kicker")}</p>
          <div className="mt-4 flex items-center gap-4">
            <span className="kids-avatar green !h-16 !w-16 !rounded-2xl !text-2xl">
              {initials(`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "?")}
            </span>
            <div>
              <h1 className="text-2xl font-bold">
                {u.firstName} {u.lastName}
              </h1>
              <span className="children-badge mt-1">{roleLabel}</span>
            </div>
          </div>
          <p className="children-muted mt-4">{t("account.intro")}</p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f7f7f0] p-4">
              <dt className="children-label !mb-1">{t("account.email")}</dt>
              <dd className="break-all font-medium">{u.email}</dd>
            </div>
            <div className="rounded-xl bg-[#f7f7f0] p-4">
              <dt className="children-label !mb-1">{t("account.role")}</dt>
              <dd className="font-medium">{roleLabel}</dd>
            </div>
          </dl>
        </section>
        <section className="children-panel">
          <h2 className="text-xl font-bold">🔒 {t("account.passwordTitle")}</h2>
          <p className="children-muted mt-2">{t("account.passwordHint")}</p>
          <div className="mt-5">
            <ChangePasswordForm />
          </div>
        </section>
      </div>
    </div>
  );
}
