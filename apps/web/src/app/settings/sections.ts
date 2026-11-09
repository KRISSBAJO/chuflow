import type { getTranslations } from "next-intl/server";
import type { IconName } from "@/components/app/icons";
import type { SessionUser } from "@/lib/auth";
import { hasFeature } from "@/lib/entitlements";
import { ministryFormKinds, type MinistryFormKind } from "@/lib/guest-fields";
import { canConfigureAppSettings } from "@/lib/permissions";

type FormKind = "guests" | "members" | "offering" | "expense" | MinistryFormKind;
type SettingsMessage = Parameters<Awaited<ReturnType<typeof getTranslations<"admin.settings">>>>[0];
type SettingsItem = { id: string; icon: IconName; title: SettingsMessage; description: SettingsMessage; form?: FormKind };

export function settingsGroups(user: SessionUser) {
  const workspace: SettingsItem[] = [
    { id: "branch-defaults", icon: "branches", title: "sections.branchDefaults", description: "sections.branchDefaultsDescription" },
  ];
  if (canConfigureAppSettings(user.role)) {
    workspace.unshift({ id: "organisation", icon: "settings", title: "sections.organisation", description: "sections.organisationDescription" });
  }
  const personal: SettingsItem[] = [
    { id: "preferences", icon: "users", title: "sections.preferences", description: "sections.preferencesDescription" },
    { id: "password", icon: "approvals", title: "sections.password", description: "sections.passwordDescription" },
    { id: "device", icon: "device", title: "sections.device", description: "sections.deviceDescription" },
  ];
  const forms: SettingsItem[] = [];
  if (user.role === "branch_admin" || user.role === "resident_pastor") {
    forms.push({ id: "branch-guest-forms", icon: "guests", title: "guestFields.branchTitle", description: "guestFields.branchDescription", form: "guests" });
  }
  if (user.role === "super_admin") {
    forms.push(
      { id: "guest-forms", icon: "guests", title: "navigation.guestForms", description: "guestFields.description", form: "guests" },
      { id: "member-form", icon: "members", title: "guestFields.memberTitle", description: "guestFields.memberDescription", form: "members" },
    );
    if (hasFeature(user.entitlements, "finance")) {
      forms.push(
        { id: "offering-form", icon: "finance", title: "guestFields.offeringTitle", description: "guestFields.financeDescription", form: "offering" },
        { id: "expense-form", icon: "finance", title: "guestFields.expenseTitle", description: "guestFields.financeDescription", form: "expense" },
      );
    }
    for (const kind of ministryFormKinds) {
      forms.push({ id: kind + "-form", icon: "templates", title: `guestFields.ministry.${kind}`, description: "guestFields.ministryDescription", form: kind });
    }
  }
  return { workspace, personal, forms };
}

export function formSettingsPath(kind: FormKind): string {
  switch (kind) {
    case "guests":
    case "members":
      return `/${kind}/form-settings`;
    case "offering":
    case "expense":
      return `/finance/form-settings/${kind}`;
    default:
      return `/guests/ministry-form-settings/${kind}`;
  }
}
