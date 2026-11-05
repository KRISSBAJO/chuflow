import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StatusShell } from "@/components/auth/auth-shell";
import { PublicConnectChooser } from "@/components/public-connect-chooser";
import { publicServerGet } from "@/lib/server-api";
import type { IntakeTemplate, PublicConnectOption, SettingsOverview } from "@/lib/types";

type ConnectPageState =
  | { kind: "disabled"; organizationName: string }
  | { kind: "chooser"; templates: PublicConnectOption[] }
  | { kind: "redirect"; slug: string }
  | { kind: "offline" }
  | { kind: "empty" };

async function getConnectPageState(): Promise<ConnectPageState> {
  try {
    const publicSettings = await publicServerGet<SettingsOverview["app"]>("/settings/public");

    if (!publicSettings.publicConnectEnabled) {
      return {
        kind: "disabled",
        organizationName: publicSettings.organizationName,
      };
    }

    const templates = await publicServerGet<PublicConnectOption[]>(
      "/intake-templates/public/templates?kind=guest",
    );

    if (templates.length === 1) {
      return { kind: "redirect", slug: templates[0].slug };
    }

    if (templates.length > 1) {
      return { kind: "chooser", templates };
    }

    const template = await publicServerGet<IntakeTemplate>("/intake-templates/public/active?kind=guest");
    return { kind: "redirect", slug: template.slug };
  } catch (error) {
    const isBackendOffline =
      error instanceof Error &&
      error.message.includes("ChuFlow API is temporarily unavailable");

    return isBackendOffline ? { kind: "offline" } : { kind: "empty" };
  }
}

export default async function ConnectPage() {
  const state = await getConnectPageState();

  if (state.kind === "redirect") {
    redirect(`/intake/${state.slug}`);
  }

  if (state.kind === "chooser") {
    return <PublicConnectChooser options={state.templates} />;
  }

  const [t, tc] = await Promise.all([getTranslations("status.connect"), getTranslations("common")]);
  const backHome = { label: tc("backToHome"), href: "/", primary: true };

  if (state.kind === "disabled") {
    return (
      <StatusShell
        label={t("label")}
        title={t("pausedTitle")}
        body={t("pausedBody", { organization: state.organizationName })}
        actions={[backHome]}
      />
    );
  }

  if (state.kind === "offline") {
    return <StatusShell label={t("label")} title={t("offlineTitle")} body={t("offlineBody")} actions={[backHome]} />;
  }

  return (
    <StatusShell
      label={t("label")}
      title={t("emptyTitle")}
      body={t("emptyBody")}
      actions={[
        { label: tc("signIn"), href: "/login", primary: true },
        { label: tc("backToHome"), href: "/" },
      ]}
    />
  );
}
