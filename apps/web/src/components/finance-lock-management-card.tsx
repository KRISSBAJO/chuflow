"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
        throw new Error(result.message || "Unable to lock finance period");
      }

      toast.success("Finance period locked", {
        description: "Branch entries in that month are now protected from further editing.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Finance lock failed", {
        description: error instanceof Error ? error.message : "Unable to lock finance period",
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
        const result = await response.json().catch(() => ({ message: "Unable to remove finance lock" }));
        throw new Error(result.message || "Unable to remove finance lock");
      }

      toast.success("Finance lock removed", {
        description: "This branch period is now open again for allowed correction workflows.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Finance unlock failed", {
        description: error instanceof Error ? error.message : "Unable to remove finance lock",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Period locks</p>
        <h3 className="text-lg font-semibold text-slate-950">Control month-end editing</h3>
      </div>

      <form action={createLock} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        {canChooseBranch ? (
          <select
            name="branchId"
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            required
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}
        <input
          name="periodKey"
          type="month"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          required
        />
        <textarea
          name="reason"
          placeholder="Optional lock reason"
          className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
        >
          {loading ? "Locking..." : "Lock period"}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {visibleLocks.length > 0 ? (
          visibleLocks.map((lock) => (
            <div
              key={lock._id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {typeof lock.branchId === "string" ? lock.branchId : lock.branchId?.name} ·{" "}
                    {lock.periodKey}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lock.reason || "Locked period"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeLock(lock._id)}
                  disabled={loadingId === lock._id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  {loadingId === lock._id ? "Removing..." : "Remove lock"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
            No finance periods are locked in the selected scope.
          </div>
        )}
      </div>
    </section>
  );
}
