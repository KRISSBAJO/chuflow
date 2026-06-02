import Link from "next/link";
import { redirect } from "next/navigation";
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
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">Public Connect</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Public connect is turned off right now</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {state.organizationName} is not accepting public guest intake from this route at the moment.
          </p>
        </div>
      </div>
    );
  }

  const isBackendOffline = state.kind === "offline";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
      <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">Public Connect</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          {isBackendOffline
            ? "Public connect is temporarily unavailable"
            : "No active first timer template is live yet"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {isBackendOffline
            ? "The public intake service is unavailable right now. Please try again shortly."
            : "Open the template manager, activate a guest intake template, and this public connect route will immediately start using it."}
        </p>
        <Link href="/login" className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          Back to login
        </Link>
      </div>
    </div>
  );
}
