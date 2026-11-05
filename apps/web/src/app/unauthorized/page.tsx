import { getTranslations } from "next-intl/server";
import { StatusShell } from "@/components/auth/auth-shell";

export default async function UnauthorizedPage() {
  const t = await getTranslations("status.unauthorized");

  return (
    <StatusShell
      label={t("label")}
      title={t("title")}
      body={t("body")}
      actions={[
        { label: t("openWorkspace"), href: "/dashboard", primary: true },
        { label: t("switchAccount"), href: "/login?reason=switch-account" },
      ]}
    />
  );
}
