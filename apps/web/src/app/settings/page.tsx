import { AppSettingsForm } from "@/components/app-settings-form";
import { BranchSettingsForm } from "@/components/branch-settings-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { LogoutButton } from "@/components/logout-button";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { requireServerRole } from "@/lib/auth";
import { canConfigureAppSettings, canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import { UserPreferencesForm } from "@/components/user-preferences-form";
import type { BranchSettingsOverview, BranchSummary, SettingsOverview } from "@/lib/types";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireServerRole("/settings");
  const isAdmin = canConfigureAppSettings(user.role);
  const resolvedSearchParams = (await searchParams) ?? {};
  const overview = await serverGet<SettingsOverview>("/settings/overview").catch(() => ({
    app: {
      organizationName: "ChuFlow",
      organizationTagline: "From Membership to Ministry",
      publicConnectEnabled: true,
      defaultReportDays: 30,
    },
    preferences: {
      interfaceDensity: "comfortable" as const,
      defaultReportDays: 30,
    },
  }));
  const branches = await serverGet<BranchSummary[]>("/branches").catch(() => []);
  const selectedBranchId =
    typeof resolvedSearchParams.branchId === "string"
      ? resolvedSearchParams.branchId
      : user.branchId || branches[0]?._id;
  const branchSettings =
    selectedBranchId
      ? await serverGet<BranchSettingsOverview>(
          `/settings/branches/${selectedBranchId}`,
        ).catch(() => null)
      : null;

  return (
    <Shell>
      <PageHeader
        eyebrow="Settings"
        title={isAdmin ? "System setup and operating defaults" : "Account security"}
        description={
          isAdmin
            ? "Security, comms, and branch-ready configuration should be transparent so the team knows what is wired already and what comes next."
            : "Manage your password and session access from one place."
        }
        action={<LogoutButton />}
      />
      {isAdmin ? (
        <section className="grid gap-6 xl:grid-cols-3">
          <section className="surface rounded-[32px] p-2">
            <AppSettingsForm app={overview.app} />
          </section>
          <section className="surface rounded-[32px] p-2">
            <UserPreferencesForm preferences={overview.preferences} />
          </section>
          <section className="surface rounded-[32px] p-2 xl:col-span-3">
            <BranchSettingsForm
              branches={branches}
              selectedBranchId={selectedBranchId}
              overview={branchSettings}
              canSelectBranch={canFilterAcrossBranches(user.role)}
            />
          </section>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          <section className="surface rounded-[32px] p-2">
            <UserPreferencesForm preferences={overview.preferences} />
          </section>
          <section className="surface rounded-[32px] p-2">
            <BranchSettingsForm
              branches={branches}
              selectedBranchId={selectedBranchId}
              overview={branchSettings}
              canSelectBranch={canFilterAcrossBranches(user.role)}
            />
          </section>
        </section>
      )}
      <section className="surface rounded-[32px] p-8">
        <ChangePasswordForm />
      </section>
    </Shell>
  );
}
