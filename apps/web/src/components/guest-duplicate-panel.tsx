"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { GuestDuplicateGroup } from "@/lib/types";

export function GuestDuplicatePanel({ groups }: { groups: GuestDuplicateGroup[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function mergeGuests(targetGuestId: string, sourceGuestId: string, mergeKey: string) {
    setLoadingKey(mergeKey);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/guests/${targetGuestId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceGuestId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to merge guests");
      }

      setStatus("Duplicate guests merged successfully.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to merge guests");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Duplicate review</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Possible duplicate guests</h2>
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {groups.length} groups
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
            No duplicate groups detected in the current scope.
          </div>
        ) : (
          groups.slice(0, 6).map((group) => {
            const [target, ...sources] = group.guests;

            return (
              <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {group.type === "email" ? "Shared email" : "Shared phone"} · {group.value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Keep the first record and merge the rest into it.
                    </p>
                  </div>
                  <a href={`/guests/${target._id}`} className="text-xs font-semibold text-orange-700">
                    Open primary record
                  </a>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                    <p className="font-semibold text-slate-900">
                      Primary: {target.firstName} {target.lastName}
                    </p>
                    <p className="mt-0.5 text-slate-500">{target.email || target.phone}</p>
                  </div>
                  {sources.map((guest) => {
                    const mergeKey = `${target._id}-${guest._id}`;
                    return (
                      <div key={guest._id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-sm">
                          <p className="font-semibold text-slate-900">
                            {guest.firstName} {guest.lastName}
                          </p>
                          <p className="mt-0.5 text-slate-500">{guest.email || guest.phone}</p>
                        </div>
                        <button
                          type="button"
                          disabled={loadingKey === mergeKey || pending}
                          onClick={() => mergeGuests(target._id, guest._id, mergeKey)}
                          className="rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white"
                        >
                          {loadingKey === mergeKey ? "Merging..." : "Merge into primary"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
