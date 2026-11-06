"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge, Button, Card, CardHeader, EmptyState, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { BranchSummary, FinanceLockSummary } from "@/lib/types";

function getLockBranchId(value: FinanceLockSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function FinanceLockManagementCard({
  locks,
  branches,
  defaultBranchId,
  canChooseBranch,
}: {
  locks: FinanceLockSummary[];
  branches: BranchSummary[];
  defaultBranchId?: string;
  canChooseBranch: boolean;
}) {
  const t = useTranslations("admin.locks");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const visibleLocks = useMemo(() => {
    if (!selectedBranchId) {
      return locks;
    }

    return locks.filter((lock) => getLockBranchId(lock.branchId) === selectedBranchId);
  }, [locks, selectedBranchId]);

  async function createLock(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/locks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          periodKey: formData.get("periodKey"),
          reason: formData.get("reason") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("lockError"));
      }

      toast.success(t("lockedTitle"), {
        description: t("lockedDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("lockFailedTitle"), {
        description: error instanceof Error ? error.message : t("lockError"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function removeLock(id: string) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/finance/locks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: t("removeError") }));
        throw new Error(result.message || t("removeError"));
      }

      toast.success(t("removedTitle"), {
        description: t("removedDescription"),
      });
      router.refresh();
    } catch (error) {
      toast.error(t("removeFailedTitle"), {
        description: error instanceof Error ? error.message : t("removeError"),
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <Badge tone={visibleLocks.length ? "warning" : "neutral"}>{t("lockedCount", { count: visibleLocks.length })}</Badge>
        }
      />

      <form action={createLock} className="mt-6 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-[#111111]">{t("lockTitle")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {canChooseBranch ? (
            <Field label={t("branch")} required>
              <select
                name="branchId"
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="ui-input"
                required
              >
                <option value="">{tc("selectBranch")}</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
          )}
          <Field label={t("month")} required className={canChooseBranch ? "" : "sm:col-span-2"}>
            <input name="periodKey" type="month" className="ui-input" required />
          </Field>
          <Field label={t("reason")} className="sm:col-span-2">
            <textarea name="reason" placeholder={t("reasonPlaceholder")} className="ui-input" />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="submit" disabled={loading}>
            {loading ? t("locking") : t("lock")}
          </Button>
        </div>
      </form>

      <div className="mt-5">
        {visibleLocks.length > 0 ? (
          <ul className="divide-y divide-black/[0.05]">
            {visibleLocks.map((lock) => (
              <li key={lock._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-[#111111]">
                      {typeof lock.branchId === "string" ? lock.branchId : lock.branchId?.name}
                    </p>
                    <Badge tone="warning">{lock.periodKey}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                    {lock.reason || t("lockedPeriod")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => removeLock(lock._id)}
                  disabled={loadingId === lock._id}
                >
                  {loadingId === lock._id ? t("removing") : t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="clock" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        )}
      </div>
    </Card>
  );
}
