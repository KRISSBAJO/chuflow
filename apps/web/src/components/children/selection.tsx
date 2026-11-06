"use client";
import { toast } from "sonner";
import { useState, type FormEvent } from "react";
import { useFlowText } from "./flow-copy";
import type { FamilySelection } from "@/lib/children";
/**
 * Step B: pick which children are staying and which classroom each goes to.
 * Used by the staff desk (publicMode=false) and the tablet kiosk (publicMode=true).
 */
export function ChildrenSelection({
  selection,
  onSubmit,
  publicMode = false,
}: {
  selection: FamilySelection;
  onSubmit: (body: {
    familyId: string;
    guardianId: string;
    adultConfirmed: boolean;
    children: { childId: string; roomId: string }[];
  }) => Promise<void>;
  publicMode?: boolean;
}) {
  const text = useFlowText();
  const [guardian, setGuardian] = useState(selection.guardians[0]?.id || ""),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const count = Object.keys(selected).length;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        familyId: selection.familyId,
        guardianId: guardian,
        adultConfirmed: confirmed,
        children: Object.entries(selected).map(([childId, roomId]) => ({
          childId,
          roomId,
        })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : text.failed);
      setError(e instanceof Error ? e.message : text.failed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="children-panel kids-fade-in space-y-5"
      aria-busy={busy}
    >
      <div>
        <p className="children-kicker">{text.heading}</p>
        <h2 className="mt-2 text-2xl font-bold">{selection.name}</h2>
      </div>
      <label className="block">
        <span className="children-label">{text.adult}</span>
        <select
          className={`children-input ${publicMode ? "lg" : ""}`}
          value={guardian}
          onChange={(e) => {
            setGuardian(e.target.value);
            setSelected({});
            setConfirmed(false);
          }}
          required
        >
          {selection.guardians.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-3">
        {selection.children.map((c) => {
          const linked = c.guardianIds.includes(guardian);
          const available = c.rooms.some((r) => r.remaining > 0);
          const chosen = c.id in selected;
          return (
            <div
              key={c.id}
              className={`rounded-2xl border p-4 transition-colors ${
                chosen
                  ? "border-[#245b4b] bg-[#f3f8f5]"
                  : "border-[#e2e6d9] bg-white"
              }`}
            >
              <label className="flex items-center gap-3 text-lg font-semibold">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[#245b4b]"
                  disabled={c.checkedIn || !linked || !available}
                  checked={chosen}
                  onChange={(e) =>
                    setSelected((rows) => {
                      const next = { ...rows };
                      if (e.target.checked)
                        next[c.id] =
                          c.rooms.find((r) => r.remaining > 0)?.id || "";
                      else delete next[c.id];
                      return next;
                    })
                  }
                />
                <span className="kids-avatar" aria-hidden="true">
                  {c.name.trim().slice(0, 1).toUpperCase()}
                </span>
                {c.name}
              </label>
              {c.checkedIn ? (
                <p className="children-badge blue mt-3">{text.already}</p>
              ) : !linked ? (
                <p className="children-muted mt-2">{text.linked}</p>
              ) : (
                <label className="mt-3 block">
                  <span className="children-label">{text.room}</span>
                  <select
                    className="children-input"
                    disabled={!chosen}
                    value={selected[c.id] || c.rooms[0]?.id || ""}
                    onChange={(e) =>
                      setSelected((rows) => ({
                        ...rows,
                        [c.id]: e.target.value,
                      }))
                    }
                  >
                    {!c.rooms.length && <option>{text.noRoom}</option>}
                    {c.rooms.map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={r.remaining < 1}
                      >
                        {r.name} · {text.spaces(r.remaining)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-0.5 h-5 w-5 accent-[#245b4b]"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
        />
        {publicMode ? text.confirm : text.staffConfirm}
      </label>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      <button
        className="children-button lg w-full"
        type="submit"
        disabled={busy || !confirmed || !count}
      >
        {busy ? text.checking : text.submit}
      </button>
    </form>
  );
}
