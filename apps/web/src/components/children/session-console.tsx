"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "@/lib/api";
import type {
  ChildSession,
  FamilySelection,
  ReceiptData,
} from "@/lib/children";
import { ChildrenSelection } from "./selection";
import { ChildrenPortrait } from "./portrait";
import { ChildrenLocalTime } from "./local-time";
import { ChildrenReceipt } from "./receipt";
export function ChildrenSessionConsole({ initial }: { initial: ChildSession }) {
  const [s, setSession] = useState(initial),
    [tab, setTab] = useState("checkin"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [results, setResults] = useState<{ _id: string; name: string }[]>([]),
    [selection, setSelection] = useState<FamilySelection | null>(null),
    [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [pickupCode, setPickupCode] = useState(""),
    [guardian, setGuardian] = useState(""),
    [identity, setIdentity] = useState(false),
    [exception, setException] = useState(false),
    [reason, setReason] = useState("");
  const [rosterSearch, setRosterSearch] = useState(""),
    [roomFilter, setRoomFilter] = useState(""),
    [rosterPage, setRosterPage] = useState(1),
    [kiosk, setKiosk] = useState<{ token: string; expiresAt: string } | null>(
      null,
    );
  const refresh = useCallback(async () => {
    const data = await apiGet<ChildSession>(
      `/children/sessions/${initial._id}`,
    );
    setSession(data);
  }, [initial._id]);
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh().catch(() =>
        setError(
          "The live roster could not refresh. Reconnect before continuing.",
        ),
      );
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      void apiGet<typeof results>(
        `/children/sessions/${s._id}/families?search=${encodeURIComponent(search)}`,
      )
        .then((r) => {
          if (active) setResults(r);
        })
        .catch(() => {
          if (active) setError("Family search unavailable.");
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, s._id]);
  async function act(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete action.");
    } finally {
      setBusy(false);
    }
  }
  async function scan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") || "").trim();
    await act(async () => {
      setSelection(
        await apiPost<FamilySelection>(`/children/sessions/${s._id}/scan`, {
          code,
        }),
      );
      setReceipt(null);
    });
  }
  async function scanPickup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await act(async () => {
      const r = await apiPost<{ visitIds: string[] }>(
        `/children/sessions/${s._id}/pickup`,
        { code: pickupCode.trim() },
      );
      setSelected(r.visitIds);
      setGuardian("");
      setIdentity(false);
    });
  }
  const active = s.visits.filter((v) => v.status === "checked_in");
  const chosen = active.filter((v) => selected.includes(v.id));
  const adults =
    chosen[0]?.authorizedPickup.filter((g) =>
      chosen.every((v) => v.authorizedPickup.some((a) => a.id === g.id)),
    ) || [];
  async function checkout(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await apiPost(`/children/sessions/${s._id}/check-out`, {
        visitIds: selected,
        guardianId: guardian,
        identityConfirmed: identity,
        expectedRevision: s.revision,
        ...(exception
          ? { exceptionReason: reason }
          : { pickupCode: pickupCode.trim() }),
      });
      setSelected([]);
      setPickupCode("");
      setIdentity(false);
      setReason("");
      setNotice(
        "Checkout recorded. Confirm the handover to the authorized adult.",
      );
    });
  }
  async function supervise(action: string, visitId?: string, roomId?: string) {
    const note = window.prompt(
      action === "reissue"
        ? "Explain how you verified the guardian before replacing the receipt (minimum 10 characters)."
        : action === "transfer"
          ? "Reason for classroom transfer (minimum 10 characters)."
          : "Reason for closing this session (minimum 10 characters).",
    );
    if (!note) return;
    await act(async () => {
      const r = await apiPost<ReceiptData>(
        `/children/sessions/${s._id}/action`,
        { action, visitId, roomId, reason: note, expectedRevision: s.revision },
      );
      if (action === "reissue") setReceipt(r);
      setNotice(
        action === "close"
          ? "Session closed. All kiosk links revoked."
          : "Supervisor action recorded.",
      );
    });
  }
  function exportRoster() {
    const rows = [
      [
        "Child",
        "Room",
        "Status",
        "Checked in",
        "Brought by",
        "Checked out",
        "Collected by",
      ],
      ...s.visits.map((v) => [
        v.childName,
        s.rooms.find((r) => r.id === v.roomId)?.name || "",
        v.status,
        v.checkedInAt,
        v.broughtByName,
        v.checkedOutAt || "",
        v.collectedByName || "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (cell) =>
                '"' +
                String(
                  /^(?:\s*[=+@-]|[\t\r\n])/.test(cell) ? "'" + cell : cell,
                ).replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "children-attendance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const visible = active.filter(
    (v) =>
      (!roomFilter || v.roomId === roomFilter) &&
      v.childName.toLowerCase().includes(rosterSearch.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 25));
  const page = Math.min(rosterPage, pages);
  return (
    <div className="space-y-5">
      <section className="children-panel">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="children-kicker">Children’s service</p>
            <h1 className="mt-2 text-3xl font-bold">{s.name}</h1>
            <p className="children-muted mt-2">
              {s.status === "open" ? "Open session" : "Closed session"} ·{" "}
              <ChildrenLocalTime value={s.startsAt} />
            </p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-3xl font-bold">{active.length}</p>
              <p className="children-muted">Here now</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{s.visits.length}</p>
              <p className="children-muted">Attended</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {s.visits.length - active.length}
              </p>
              <p className="children-muted">Collected</p>
            </div>
          </div>
        </div>
        <div
          className="children-tabs mt-6"
          role="tablist"
          aria-label="Children’s service tasks"
        >
          {[
            ["checkin", "A · Check in"],
            ["rooms", "B · Rooms"],
            ["pickup", "C · Pickup"],
            ...(s.canManage ? [["manage", "Supervisor"]] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setError("");
                setNotice("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-[#e8f3e7] p-4 text-sm">
          {notice}
        </p>
      )}
      {receipt && (
        <ChildrenReceipt
          data={receipt}
          onDone={() => {
            setReceipt(null);
            setSelection(null);
            setSearch("");
            setResults([]);
          }}
        />
      )}
      {s.status !== "open" && tab === "checkin" && (
        <p className="children-panel children-muted">
          This session is closed. A supervisor can view its attendance history
          and export the roster.
        </p>
      )}
      {tab === "checkin" && s.status === "open" && !receipt && (
        <div className="children-grid items-start">
          <div className="space-y-5">
            <form className="children-panel" onSubmit={scan}>
              <p className="children-kicker">Scan a permanent card</p>
              <h2 className="mt-2 text-2xl font-bold">A friendly hello</h2>
              <p className="children-muted my-4">
                Use a USB / Bluetooth QR scanner, or enter the code from the
                family card.
              </p>
              <label className="children-label" htmlFor="child-card">
                Family or child QR code
              </label>
              <input
                id="child-card"
                name="code"
                autoComplete="off"
                className="children-input font-mono"
                placeholder="Scan card here…"
                required
              />
              <button
                type="submit"
                className="children-button mt-4"
                disabled={busy}
              >
                Find family
              </button>
            </form>
            <section className="children-panel">
              <h2 className="text-lg font-bold">Forgotten card?</h2>
              <p className="children-muted mt-1">
                Staff-assisted search by family, guardian name or phone.
              </p>
              <input
                className="children-input mt-4"
                aria-label="Search families"
                placeholder="Start typing at least 2 characters…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setResults([]);
                }}
              />
              {search.length >= 2 &&
                results.map((f) => (
                  <button
                    key={f._id}
                    type="button"
                    className="block w-full border-b border-[#e4e8dc] p-3 text-left"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        setSelection(
                          await apiGet(
                            `/children/sessions/${s._id}/families/${f._id}`,
                          ),
                        );
                      })
                    }
                  >
                    {f.name} →
                  </button>
                ))}
              {s.canManage && (
                <Link
                  href={`/children/families/new?branchId=${s.branchId}`}
                  className="mt-4 inline-block text-sm underline"
                >
                  First visit? Register a family
                </Link>
              )}
            </section>
          </div>
          {selection ? (
            <ChildrenSelection
              key={selection.familyId}
              selection={selection}
              onSubmit={async (body) => {
                const r = await apiPost<ReceiptData>(
                  `/children/sessions/${s._id}/check-in`,
                  body,
                );
                setReceipt(r);
                setSelection(null);
                await refresh();
              }}
            />
          ) : (
            <div className="children-panel flex min-h-64 items-center justify-center text-center">
              <div>
                <span className="text-5xl" aria-hidden="true">
                  ☀
                </span>
                <p className="mt-4 text-xl font-semibold">
                  Ready for the next family
                </p>
                <p className="children-muted mt-2">
                  Scan a card or use the staff search to begin.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "rooms" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.rooms.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  setRoomFilter(r.id);
                  setRosterPage(1);
                }}
                className="children-panel children-room text-left"
              >
                <h2 className="text-xl font-bold">{r.name}</h2>
                <p className="mt-3 text-3xl font-bold">
                  {active.filter((v) => v.roomId === r.id).length}
                  <span className="text-lg font-normal text-[#7a8978]">
                    {" "}
                    / {r.capacity}
                  </span>
                </p>
                <p className="children-muted">
                  {r.minMonths}–{r.maxMonths} months
                </p>
              </button>
            ))}
          </div>
          <div className="children-panel">
            <div className="flex flex-wrap gap-3">
              <input
                aria-label="Search room roster"
                className="children-input max-w-sm"
                placeholder="Find a checked-in child"
                value={rosterSearch}
                onChange={(e) => {
                  setRosterSearch(e.target.value);
                  setRosterPage(1);
                }}
              />
              <select
                className="children-input max-w-xs"
                aria-label="Filter classroom"
                value={roomFilter}
                onChange={(e) => {
                  setRoomFilter(e.target.value);
                  setRosterPage(1);
                }}
              >
                <option value="">All rooms</option>
                {s.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="children-button secondary"
                onClick={() => void act(refresh)}
              >
                Refresh roster
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {visible.slice((page - 1) * 25, page * 25).map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-[#e4e7da] p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <ChildrenPortrait url={v.photoUrl} name={v.childName} />
                        <h3 className="text-lg font-bold">{v.childName}</h3>
                      </div>
                      <p className="children-muted">
                        {s.rooms.find((r) => r.id === v.roomId)?.name} · Brought
                        by {v.broughtByName}
                      </p>
                    </div>
                    <span className="children-badge font-mono">
                      {v.pickupDisplay}
                    </span>
                  </div>
                  {v.careNotes && (
                    <details className="mt-3 rounded-lg bg-amber-50 p-3">
                      <summary className="cursor-pointer font-semibold text-sm">
                        Care instructions — authorized team only
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {v.careNotes}
                      </p>
                    </details>
                  )}
                  {v.pickupNotes && (
                    <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm">
                      Pickup instructions: {v.pickupNotes}
                    </p>
                  )}
                  {s.canManage && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <select
                        aria-label={`Transfer ${v.childName}`}
                        className="children-input max-w-xs"
                        value={v.roomId}
                        onChange={(e) =>
                          void supervise("transfer", v.id, e.target.value)
                        }
                        disabled={busy}
                      >
                        {s.rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="children-button secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void supervise("reissue", v.id)}
                      >
                        Replace pickup receipt
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!visible.length && (
                <p className="children-muted p-6 text-center">
                  No checked-in children match.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-between text-sm">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-3">
                <button
                  disabled={page === 1}
                  onClick={() => setRosterPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={page === pages}
                  onClick={() => setRosterPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab === "pickup" && (
        <div className="children-grid items-start">
          <div className="children-panel">
            <p className="children-kicker">C · A careful goodbye</p>
            <h2 className="mt-2 text-2xl font-bold">Verify before pickup</h2>
            <p className="children-muted mt-3">
              Scan the guardian’s visit receipt. Permanent identification cards
              do not authorize collection.
            </p>
            <form onSubmit={scanPickup} className="mt-4 space-y-3">
              <label className="children-label" htmlFor="pickup-scan">
                Guardian pickup QR code
              </label>
              <input
                id="pickup-scan"
                className="children-input font-mono"
                value={pickupCode}
                onChange={(e) => {
                  setPickupCode(e.target.value);
                  setSelected([]);
                  setIdentity(false);
                }}
                placeholder="Scan pickup receipt…"
                required={!exception}
              />
              <button
                className="children-button"
                disabled={busy || !pickupCode}
              >
                Verify receipt
              </button>
            </form>
            {s.canManage && (
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exception}
                  onChange={(e) => {
                    setException(e.target.checked);
                    setSelected([]);
                    setIdentity(false);
                  }}
                />
                Supervisor: lost receipt / verified exception
              </label>
            )}
            {exception && (
              <div className="mt-4 space-y-3">
                <label className="children-label">
                  Select a child after verifying the adult
                </label>
                <select
                  className="children-input"
                  value={selected[0] || ""}
                  onChange={(e) => {
                    setSelected(e.target.value ? [e.target.value] : []);
                    setGuardian("");
                    setIdentity(false);
                  }}
                >
                  <option value="">Choose checked-in child</option>
                  {active.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.childName}
                    </option>
                  ))}
                </select>
                <textarea
                  className="children-input min-h-24"
                  placeholder="How was the adult’s identity verified? Minimum 10 characters."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={10}
                />
              </div>
            )}
          </div>
          {chosen.length > 0 ? (
            <form onSubmit={checkout} className="children-panel space-y-4">
              <h2 className="text-xl font-bold">Confirm the handover</h2>
              {chosen.map((v) => (
                <div key={v.id} className="rounded-xl bg-[#f6f7ee] p-4">
                  <label className="flex gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={selected.includes(v.id)}
                      onChange={(e) => {
                        if (!e.target.checked)
                          setSelected((ids) => ids.filter((id) => id !== v.id));
                      }}
                    />
                    <ChildrenPortrait url={v.photoUrl} name={v.childName} />{" "}
                    {v.childName}
                  </label>
                  <p className="children-muted mt-1">
                    {s.rooms.find((r) => r.id === v.roomId)?.name}
                  </p>
                  {v.pickupNotes && (
                    <p className="mt-2 text-sm font-semibold text-[#9b4a31]">
                      {v.pickupNotes}
                    </p>
                  )}
                </div>
              ))}
              <label className="block">
                <span className="children-label">
                  Collecting adult — authorized for all selected children
                </span>
                <select
                  className="children-input"
                  value={guardian}
                  onChange={(e) => {
                    setGuardian(e.target.value);
                    setIdentity(false);
                  }}
                  required
                >
                  <option value="">Identify the adult at the desk</option>
                  {adults.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.relationship}
                    </option>
                  ))}
                </select>
              </label>
              {guardian && (
                <p className="children-muted">
                  Recorded contact:{" "}
                  {adults.find((g) => g.id === guardian)?.phone}
                </p>
              )}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={identity}
                  onChange={(e) => setIdentity(e.target.checked)}
                  required
                />
                I have verified this adult’s identity and checked the pickup
                instructions. The children are ready to be handed over.
              </label>
              <button
                className="children-button w-full"
                disabled={
                  busy ||
                  !identity ||
                  !guardian ||
                  (exception && reason.trim().length < 10)
                }
              >
                {busy ? "Recording…" : "Confirm checkout & handover"}
              </button>
            </form>
          ) : (
            <div className="children-panel children-muted">
              The children matched to a valid pickup receipt will appear here.
              No child is released by scanning alone.
            </div>
          )}
        </div>
      )}
      {tab === "manage" && s.canManage && (
        <section className="children-panel space-y-5">
          <h2 className="text-2xl font-bold">Supervisor tools</h2>
          <p className="children-muted">
            Use the public kiosk in a separate browser profile that is not
            signed into the staff app. Kiosk links expire after eight hours or
            at session end, whichever comes first.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="children-button"
              disabled={busy || s.status !== "open"}
              onClick={() =>
                void act(async () => {
                  setKiosk(
                    await apiPost(`/children/sessions/${s._id}/kiosks`, {
                      label: "Welcome station",
                    }),
                  );
                })
              }
            >
              Create kiosk link
            </button>
            <button
              type="button"
              className="children-button secondary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await apiPost(
                    `/children/sessions/${s._id}/kiosks/revoke`,
                    {},
                  );
                  setKiosk(null);
                  setNotice(
                    "All kiosk links for this session have been revoked.",
                  );
                })
              }
            >
              Revoke kiosk links
            </button>
            <button
              type="button"
              className="children-button secondary"
              onClick={exportRoster}
            >
              Download attendance CSV
            </button>
            <button
              type="button"
              className="children-button secondary"
              disabled={busy || active.length > 0 || s.status !== "open"}
              onClick={() => void supervise("close")}
            >
              Close session
            </button>
          </div>
          {kiosk && (
            <div className="rounded-xl bg-[#f3f5e9] p-4">
              <p className="text-sm font-semibold">
                Kiosk link — treat as a temporary access credential
              </p>
              <a
                href={`/children-kiosk/${kiosk.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all text-sm underline"
              >
                {typeof window !== "undefined" ? window.location.origin : ""}
                /children-kiosk/{kiosk.token}
              </a>
              <p className="children-muted mt-2">
                Expires <ChildrenLocalTime value={kiosk.expiresAt} />
              </p>
            </div>
          )}
          <p className="children-muted">
            This is the children’s attendance roster. Use its unique-child total
            when preparing the service report; it does not add a second copy to
            the general headcount.
          </p>
          <details>
            <summary className="cursor-pointer font-semibold">
              Activity history
            </summary>
            <ol className="mt-4 max-h-96 overflow-auto divide-y divide-[#e3e6da]">
              {s.events
                .slice()
                .reverse()
                .map((e, i) => (
                  <li className="py-3 text-sm" key={i}>
                    <strong>{e.action.replaceAll("_", " ")}</strong>
                    <p>{e.note}</p>
                    <p className="children-muted">
                      <ChildrenLocalTime value={e.at} /> ·{" "}
                      {e.actorId.startsWith("kiosk:")
                        ? "Welcome kiosk"
                        : "Staff " + e.actorId}
                    </p>
                  </li>
                ))}
            </ol>
          </details>
        </section>
      )}
    </div>
  );
}
