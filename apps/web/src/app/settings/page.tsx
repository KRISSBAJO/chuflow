import { AppSettingsForm } from "@/components/app-settings-form";
import { GuestFieldsSettings } from "@/components/guest-fields-settings";
import { ministryFormKinds, type GuestFormSettings } from "@/lib/guest-fields";
import { hasFeature } from "@/lib/entitlements";
import { BranchSettingsForm } from "@/components/branch-settings-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { LogoutButton } from "@/components/logout-button";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { DeviceSettings } from "@/components/pwa/device-settings";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { canConfigureAppSettings, canFilterAcrossBranches } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import { UserPreferencesForm } from "@/components/user-preferences-form";
import { Divider } from "@/components/ui/ui";
import type { ReactNode } from "react";
import type { BranchSettingsOverview, BranchSummary, SettingsOverview } from "@/lib/types";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireServerRole("/settings");
  const t = await getTranslations("admin.settings");
  const isAdmin = canConfigureAppSettings(user.role);
  const [guestForms, memberForms] = user.role === "super_admin"
    ? await Promise.all([
        serverGet<GuestFormSettings>("/guests/form-settings"),
        serverGet<GuestFormSettings>("/members/form-settings"),
      ])
    : [null, null];
  const [offeringForms, expenseForms] = user.role === "super_admin" && hasFeature(user.entitlements, "finance")
    ? await Promise.all([
        serverGet<GuestFormSettings>("/finance/form-settings/offering"),
        serverGet<GuestFormSettings>("/finance/form-settings/expense"),
      ])
    : [null, null];
  const ministryForms = user.role === "super_admin"
    ? await Promise.all(ministryFormKinds.map(async (kind) => ({
        kind, definition: await serverGet<GuestFormSettings>(`/guests/ministry-form-settings/${kind}`),
      })))
    : [];
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
  const branches = await serverGet<BranchSummary[]>("/branches/options").catch(() => []);
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

  const branchForm = (
    <BranchSettingsForm
      branches={branches}
      selectedBranchId={selectedBranchId}
      overview={branchSettings}
      canSelectBranch={canFilterAcrossBranches(user.role, user.hasOversight)}
    />
  );

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={isAdmin ? t("adminTitle") : t("userTitle")}
        description={
          isAdmin
            ? t("adminDescription")
            : t("userDescription")
        }
        action={<LogoutButton />}
      />

      <div className="app-rise flex flex-col gap-8">
        {isAdmin ? (
          <>
            <SettingsSection
              title={t("sections.organisation")}
              description={t("sections.organisationDescription")}
            >
              <AppSettingsForm app={overview.app} />
            </SettingsSection>
            <Divider />
          </>
        ) : null}

        {guestForms ? (
          <>
            <SettingsSection title={t("guestFields.title")} description={t("guestFields.description")}>
              <GuestFieldsSettings initial={guestForms} />
            </SettingsSection>
            <Divider />
          </>
        ) : null}
        {memberForms ? (
          <>
            <SettingsSection title={t("guestFields.memberTitle")} description={t("guestFields.memberDescription")}>
              <GuestFieldsSettings initial={memberForms} kind="members" />
            </SettingsSection>
            <Divider />
          </>
        ) : null}
        {offeringForms && expenseForms ? (
          <>
            <SettingsSection title={t("guestFields.offeringTitle")} description={t("guestFields.financeDescription")}>
              <GuestFieldsSettings initial={offeringForms} kind="offering" />
            </SettingsSection>
            <Divider />
            <SettingsSection title={t("guestFields.expenseTitle")} description={t("guestFields.financeDescription")}>
              <GuestFieldsSettings initial={expenseForms} kind="expense" />
            </SettingsSection>
            <Divider />
          </>
        ) : null}
        {ministryForms.map(({ kind, definition }) => (
          <div key={kind} className="space-y-8">
            <SettingsSection title={t(`guestFields.ministry.${kind}`)} description={t("guestFields.ministryDescription")}>
              <GuestFieldsSettings initial={definition} kind={kind} />
            </SettingsSection>
            <Divider />
          </div>
        ))}

        <SettingsSection
          title={t("sections.preferences")}
          description={t("sections.preferencesDescription")}
        >
          <UserPreferencesForm preferences={overview.preferences} />
        </SettingsSection>
        <Divider />

        <SettingsSection
          title={t("sections.device")}
          description={t("sections.deviceDescription")}
        >
          <DeviceSettings />
        </SettingsSection>
        <Divider />

        <SettingsSection
          title={t("sections.branchDefaults")}
          description={t("sections.branchDefaultsDescription")}
        >
          {branchForm}
        </SettingsSection>
        <Divider />

        <SettingsSection
          title={t("sections.password")}
          description={t("sections.passwordDescription")}
        >
          <ChangePasswordForm />
        </SettingsSection>
      </div>
    </Shell>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10">
      <div className="lg:pt-2">
        <h2 className="lp-heading text-[18px] leading-tight">{title}</h2>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
