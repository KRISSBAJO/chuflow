import { useFormatter, useLocale, useTranslations } from "next-intl";
import { formatRoleLabel, getUserScopeLabel, isDistrictRole, isGlobalRole, isNationalRole } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

/*
 * Translated versions of the label helpers in `lib/permissions` and `components/ui/ui`.
 * `useTranslations` from next-intl works in both server and client components, so these can be
 * called from either. Unknown values fall back to the English helpers.
 */

type RoleKey = Parameters<ReturnType<typeof useTranslations<"roles">>>[0];
type StatusKey = Parameters<ReturnType<typeof useTranslations<"statuses">>>[0];

export function useRoleLabel() {
  const t = useTranslations("roles");
  return (role?: string) => (role && t.has(role as RoleKey) ? t(role as RoleKey) : formatRoleLabel(role));
}

export function useScopeLabel() {
  const t = useTranslations("scope");
  return (user: Pick<SessionUser, "role" | "oversightRegion" | "district" | "hasOversight"> | null) => {
    if (!user?.role) return "";
    if (user.hasOversight) return t("oversight");
    if (isGlobalRole(user.role)) return t("overall");
    if (isNationalRole(user.role)) return user.oversightRegion || t("national");
    if (isDistrictRole(user.role)) {
      if (user.district && user.oversightRegion) return `${user.district} · ${user.oversightRegion}`;
      return user.district || t("district");
    }
    return getUserScopeLabel(user) === "Branch scope" ? t("branch") : getUserScopeLabel(user);
  };
}

/** Human label for a workflow status such as `prayed_with`; unknown statuses are title-cased. */
export function useStatusLabel() {
  const t = useTranslations("statuses");
  return (value?: string | null) => {
    if (!value) return "";
    const key = value.toLowerCase();
    if (t.has(key as StatusKey)) return t(key as StatusKey);
    const text = value.replace(/_/g, " ").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
}

/** Locale-aware number and date helpers for the signed-in pages. */
export function useAppFormat() {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations("common");

  return {
    locale,
    number: (value: number) => format.number(value),
    date: (value: string | Date | null | undefined, style: "short" | "medium" | "long" = "medium") => {
      if (!value) return "";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return format.dateTime(date, style === "short" ? { month: "short", day: "numeric" } : style === "long" ? { dateStyle: "long" } : { month: "short", day: "numeric", year: "numeric" });
    },
    dateTime: (value: string | Date | null | undefined) => {
      if (!value) return "";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
    },
    /** "today", "3 days ago", "in 2 days", or a short date beyond a month. */
    relative: (value: string | Date | null | undefined) => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
      if (Math.abs(days) < 1) return t("today");
      if (Math.abs(days) < 30) return format.relativeTime(date);
      return format.dateTime(date, { month: "short", day: "numeric", year: "numeric" });
    },
  };
}
