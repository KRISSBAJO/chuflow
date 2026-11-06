"use client";
import { useState, type FormEvent } from "react";
import { flowCopy, type ChildrenFlowText } from "./flow-copy";
import type { FamilySelection } from "@/lib/children";
export function ChildrenSelection({
  selection,
  onSubmit,
  publicMode = false,
  text = flowCopy.en,
}: {
  selection: FamilySelection;
  onSubmit: (body: {
    familyId: string;
    guardianId: string;
    adultConfirmed: boolean;
    children: { childId: string; roomId: string }[];
  }) => Promise<void>;
  publicMode?: boolean;
  text?: ChildrenFlowText;
}) {
  const [guardian, setGuardian] = useState(selection.guardians[0]?.id || ""),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
      setError(
        e instanceof Error
          ? e.message
          : "Check-in failed. Ask the welcome team for help.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="children-panel space-y-5">
      <div>
        <p className="children-kicker">{text.heading}</p>
        <h2 className="mt-2 text-2xl font-bold">{selection.name}</h2>
      </div>
      <label className="block">
        <span className="children-label">{text.adult}</span>
        <select
          className="children-input"
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
        {selection.children.map((c) => (
          <div key={c.id} className="rounded-xl border border-[#e2e6d9] p-4">
            <label className="flex items-center gap-3 text-lg font-semibold">
              <input
                type="checkbox"
                disabled={
                  c.checkedIn ||
                  !c.guardianIds.includes(guardian) ||
                  !c.rooms.some((r) => r.remaining > 0)
                }
                checked={c.id in selected}
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
              {c.name}
            </label>
            {c.checkedIn ? (
              <p className="children-muted mt-2">{text.already}</p>
            ) : !c.guardianIds.includes(guardian) ? (
              <p className="children-muted mt-2">{text.linked}</p>
            ) : (
              <label className="mt-3 block">
                <span className="children-label">{text.room}</span>
                <select
                  className="children-input"
                  disabled={!(c.id in selected)}
                  value={selected[c.id] || c.rooms[0]?.id || ""}
                  onChange={(e) =>
                    setSelected((rows) => ({ ...rows, [c.id]: e.target.value }))
                  }
                >
                  {!c.rooms.length && <option>{text.noRoom}</option>}
                  {c.rooms.map((r) => (
                    <option key={r.id} value={r.id} disabled={r.remaining < 1}>
                      {r.name} · {r.remaining} {text.spaces}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
        />
        {publicMode
          ? text.confirm
          : "I have confirmed the adult bringing these children."}
      </label>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      <button
        className="children-button w-full"
        type="submit"
        disabled={busy || !confirmed || !Object.keys(selected).length}
      >
        {busy ? text.checking : text.submit}
      </button>
    </form>
  );
}
