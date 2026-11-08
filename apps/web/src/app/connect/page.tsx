import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StatusShell } from "@/components/auth/auth-shell";
import { PublicConnectChooser } from "@/components/public-connect-chooser";
import { publicServerGet } from "@/lib/server-api";
import type { IntakeTemplate, PublicConnectOption, SettingsOverview } from "@/lib/types";
import { workspaceApiContext, workspaceId } from "@/lib/workspace-routing";
import { notFound } from "next/navigation";

type ConnectPageState =
  | { kind: "disabled"; organizationName: string }
  | { kind: "chooser"; templates: PublicConnectOption[] }
  | { kind: "redirect"; slug: string }
  | { kind: "offline" }
  | { kind: "empty" };

async function getConnectPageState(apiBase?: string): Promise<ConnectPageState> {
  try {
    const publicSettings = await publicServerGet<SettingsOverview["app"]>("/settings/public", apiBase);

    if (!publicSettings.publicConnectEnabled) {
      return {
        kind: "disabled",
        organizationName: publicSettings.organizationName,
      };
    }

    const templates = await publicServerGet<PublicConnectOption[]>(
      "/intake-templates/public/templates?kind=guest",
      apiBase,
    );

    if (templates.length === 1) {
      return { kind: "redirect", slug: templates[0].slug };
    }

    if (templates.length > 1) {
      return { kind: "chooser", templates };
    }

    const template = await publicServerGet<IntakeTemplate>("/intake-templates/public/active?kind=guest", apiBase);
    return { kind: "redirect", slug: template.slug };
  } catch (error) {
    const isBackendOffline =
      error instanceof Error &&
      error.message.includes("ChuFlow API is temporarily unavailable");

    return isBackendOffline ? { kind: "offline" } : { kind: "empty" };
  }
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const scope = workspaceId(workspace);
  if (workspace && !scope) notFound();
  const state = await getConnectPageState(scope ? workspaceApiContext(scope).base : undefined);
  const query = scope ? `?workspace=${encodeURIComponent(scope)}` : "";

  if (state.kind === "redirect") {
    redirect(`/intake/${state.slug}${query}`);
  }

  if (state.kind === "chooser") {
    return <PublicConnectChooser options={state.templates} workspaceQuery={query} />;
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
