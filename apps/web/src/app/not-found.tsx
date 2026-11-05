import { getTranslations } from "next-intl/server";
import { StatusShell } from "@/components/auth/auth-shell";

export default async function NotFoundPage() {
  const [t, tc] = await Promise.all([getTranslations("status.notFound"), getTranslations("common")]);

  return (
    <StatusShell
      label={t("label")}
      title={t("title")}
      body={t("body")}
      actions={[
        { label: tc("openDashboard"), href: "/dashboard", primary: true },
        { label: tc("backToHome"), href: "/" },
      ]}
    />
  );
}
