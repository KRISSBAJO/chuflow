import { redirect } from "next/navigation";
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

  if (state.kind === "disabled") {
    return (
      <StatusShell
        label="Connect"
        title="Guest registration is paused."
        body={`${state.organizationName} isn't accepting guest registrations online right now. Please speak to a member of the welcome team.`}
        actions={[{ label: "Back to home", href: "/", primary: true }]}
      />
    );
  }

  if (state.kind === "offline") {
    return (
      <StatusShell
        label="Connect"
        title="We'll be right back."
        body="Guest registration is temporarily unavailable. Please try again in a few minutes."
        actions={[{ label: "Back to home", href: "/", primary: true }]}
      />
    );
  }

  return (
    <StatusShell
      label="Connect"
      title="Guest registration isn't open yet."
      body="There is no active guest form at the moment. If you manage this church, activate a guest intake template in ChuFlow."
      actions={[
        { label: "Sign in", href: "/login", primary: true },
        { label: "Back to home", href: "/" },
      ]}
    />
  );
}
