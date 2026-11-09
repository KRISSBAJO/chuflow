import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/app/icons";
import { AppSettingsForm } from "@/components/app-settings-form";
import { BranchSettingsForm } from "@/components/branch-settings-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { GuestFieldsSettings } from "@/components/guest-fields-settings";
import { DeviceSettings } from "@/components/pwa/device-settings";
import { Shell } from "@/components/shell";
import { UserPreferencesForm } from "@/components/user-preferences-form";
import { requireServerRole, type SessionUser } from "@/lib/auth";
import type { GuestFormSettings } from "@/lib/guest-fields";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type { BranchSettingsOverview, BranchSummary, SettingsOverview } from "@/lib/types";
import { formSettingsPath, settingsGroups } from "../sections";

export default async function SettingsDetailPage({
  params, searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const [user, t, { section }] = await Promise.all([requireServerRole("/settings"), getTranslations("admin.settings"), params]);
  const item = Object.values(settingsGroups(user)).flat().find(({ id }) => id === section);
  if (!item) notFound();

  let content;
  if (item.form) {
    const branch = section === "branch-guest-forms";
    const path = branch ? "/guests/branch-form-settings" : formSettingsPath(item.form);
    const settings = await serverGet<GuestFormSettings>(path);
    content = <GuestFieldsSettings initial={settings} kind={item.form} branch={branch} />;
  } else if (section === "organisation" || section === "preferences") {
    const overview = await serverGet<SettingsOverview>("/settings/overview");
    content = section === "organisation"
      ? <AppSettingsForm app={overview.app} />
      : <UserPreferencesForm preferences={overview.preferences} />;
  } else if (section === "branch-defaults") {
    content = <BranchDefaults user={user} branchId={(await searchParams).branchId} />;
  } else {
    content = section === "device" ? <DeviceSettings /> : <ChangePasswordForm />;
  }

  return (
    <Shell>
      <div className="app-rise mx-auto w-full max-w-3xl space-y-5">
        <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-medium hover:bg-[var(--lp-panel)]">
          <Icon name="arrowLeft" className="h-4 w-4" />
          {t("navigation.back")}
        </Link>
        <header>
          <h1 className="lp-heading text-3xl leading-tight sm:text-4xl">{t(item.title)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">{t(item.description)}</p>
        </header>
        {content}
      </div>
    </Shell>
  );
}

async function BranchDefaults({ user, branchId }: { user: SessionUser; branchId?: string }) {
  const branches = await serverGet<BranchSummary[]>("/branches/options").catch(() => []);
  const selectedBranchId = typeof branchId === "string" && branchId ? branchId : user.branchId || branches[0]?._id;
  const overview = selectedBranchId
    ? await serverGet<BranchSettingsOverview>(`/settings/branches/${encodeURIComponent(selectedBranchId)}`).catch(() => null)
    : null;
  return (
    <BranchSettingsForm
      key={selectedBranchId}
      branches={branches}
      selectedBranchId={selectedBranchId}
      overview={overview}
      canSelectBranch={canFilterAcrossBranches(user.role, user.hasOversight)}
    />
  );
}
