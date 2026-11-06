"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { apiGet, apiPost } from "@/lib/api";
import type {
  ChildSession,
  ChildVisit,
  FamilySelection,
  ReceiptData,
  Room,
} from "@/lib/children";
import { CameraScan } from "./camera-scan";
import { ChildrenLocalTime } from "./local-time";
import { ChildrenPortrait } from "./portrait";
import { ChildrenQr, ChildrenReceipt } from "./receipt";
import { ChildrenSelection } from "./selection";

/* ------------------------------------------------------------------------ */
/* Local types & helpers                                                     */
/* ------------------------------------------------------------------------ */

type Tab = "checkin" | "rooms" | "pickup" | "supervisor";
type Phase = "upcoming" | "live" | "ending" | "overdue" | "closed";
type KioskLink = { token: string; expiresAt: string; label: string };
type Pending =
  | { action: "close" }
  | { action: "transfer"; visit: ChildVisit; room: Room }
  | { action: "reissue"; visit: ChildVisit };
type Translate = ReturnType<typeof useTranslations<"childrenDesk">>;

const TABS: Tab[] = ["checkin", "rooms", "pickup", "supervisor"];
const PAGE_SIZE = 25;
const REFRESH_MS = 15000;
const MIN_REASON = 10;
const ROOM_TONES = ["", "green", "blue", "plum"];
const TIMELINE_ACTIONS = [
  "check_in",
  "check_out",
  "checkout_exception",
  "transfer",
  "reissue",
  "session_created",
  "session_closed",
  "card_replaced",
  "child_registered",
  "child_updated",
  "family_registered",
  "family_updated",
] as const;
type TimelineAction = (typeof TIMELINE_ACTIONS)[number];
const TIMELINE_TONE: Partial<Record<TimelineAction, string>> = {
  check_out: "blue",
  checkout_exception: "rose",
  transfer: "amber",
  reissue: "plum",
  session_closed: "rose",
  card_replaced: "plum",
};
const isTab = (value: string | null): value is Tab =>
  (TABS as string[]).includes(value || "");
const isTimelineAction = (value: string): value is TimelineAction =>
  (TIMELINE_ACTIONS as readonly string[]).includes(value);

/* A shared minute ticker so "in for 42 min" stays fresh without re-render storms. */
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | undefined;
function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (!tickTimer)
    tickTimer = setInterval(
      () => tickListeners.forEach((fn) => fn()),
      30000,
    );
  return () => {
    tickListeners.delete(listener);
    if (!tickListeners.size && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = undefined;
    }
  };
}
const minuteSnapshot = () => Math.floor(Date.now() / 60000) * 60000;
const serverSnapshot = () => null;
/** Current time rounded to the minute; `null` during server render / hydration. */
function useMinuteNow() {
  return useSyncExternalStore(subscribeTick, minuteSnapshot, serverSnapshot);
}

function durationLabel(t: Translate, checkedInAt: string, now: number | null) {
  if (now === null) return "";
  const minutes = Math.max(0, Math.floor((now - Date.parse(checkedInAt)) / 60000));
  if (minutes < 1) return t("rooms.justArrived");
  if (minutes < 60) return t("rooms.inForMinutes", { minutes });
  return t("rooms.inForHours", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}
function ageLabel(t: Translate, months: number) {
  if (months < 12) return t("rooms.months", { count: months });
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest
    ? t("rooms.yearsMonths", { years, months: rest })
    : t("rooms.years", { count: years });
}
function phaseOf(s: ChildSession, present: number, now: number | null): Phase {
  if (s.status !== "open") return "closed";
  if (now === null) return "live";
  const starts = Date.parse(s.startsAt);
  const ends = Date.parse(s.endsAt);
  if (now < starts) return "upcoming";
  if (now > ends) return present > 0 ? "overdue" : "ending";
  if (ends - now <= 15 * 60000) return "ending";
  return "live";
}
const PHASE_DOT: Record<Phase, string> = {
  upcoming: "amber",
  live: "",
  ending: "amber",
  overdue: "rose",
  closed: "still",
};
const PHASE_BADGE: Record<Phase, string> = {
  upcoming: "amber",
  live: "",
  ending: "amber",
  overdue: "rose",
  closed: "neutral",
};
function csvCell(cell: string) {
  const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(cell) ? "'" + cell : cell;
  return '"' + safe.replaceAll('"', '""') + '"';
}

/* ------------------------------------------------------------------------ */
/* Small presentational pieces                                               */
/* ------------------------------------------------------------------------ */

function Stat({
  tone,
  value,
  label,
  hint,
}: {
  tone: string;
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className={`kids-stat ${tone}`}>
      <span className="kids-stat-value">{value}</span>
      <span className="kids-stat-label">{label}</span>
      {hint && <span className="kids-stat-hint">{hint}</span>}
    </div>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="children-panel">
      <div className="kids-empty min-h-64">
        <span className="kids-empty-icon" aria-hidden="true">
          {icon}
        </span>
        <p className="text-xl font-semibold text-[#203733]">{title}</p>
        <p className="children-muted">{body}</p>
      </div>
    </div>
  );
}

/** Inline replacement for window.prompt(): a small amber panel with a reason box. */
function ReasonForm({
  title,
  body,
  busy,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("childrenDesk");
  const [reason, setReason] = useState("");
  const missing = MIN_REASON - reason.trim().length;
  return (
    <form
      className="kids-fade-in mt-4 space-y-3 rounded-2xl border border-[#f3dcb3] bg-[#fff7e6] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing <= 0) onConfirm(reason.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <p className="font-semibold text-[#6e4511]">{title}</p>
      <p className="children-muted">{body}</p>
      <label className="block">
        <span className="children-label">{t("supervisor.reason.label")}</span>
        <textarea
          autoFocus
          className="children-input min-h-20"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("supervisor.reason.placeholder")}
          minLength={MIN_REASON}
          required
        />
      </label>
      {reason.length > 0 && missing > 0 && (
        <p className="text-xs text-[#8a9589]">
          {t("pickup.reasonShort", { count: missing })}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={`children-button ${danger ? "danger" : ""}`}
          disabled={busy || missing > 0}
        >
          {busy ? t("common.working") : confirmLabel}
        </button>
        <button
          type="button"
          className="children-button secondary"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* The desk                                                                  */
/* ------------------------------------------------------------------------ */

export function ChildrenSessionConsole({ initial }: { initial: ChildSession }) {
  const t = useTranslations("childrenDesk");
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const deepCode = params.get("code");
  const now = useMinuteNow();

  /* ---- shared state ---------------------------------------------------- */
  const [s, setSession] = useState(initial);
  const [tab, setTab] = useState<Tab>(() => {
    const wanted = params.get("tab");
    return isTab(wanted) && (wanted !== "supervisor" || initial.canManage)
      ? wanted
      : "checkin";
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ---- check-in -------------------------------------------------------- */
  const [cardCode, setCardCode] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ _id: string; name: string }[]>([]);
  const [selection, setSelection] = useState<FamilySelection | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);

  /* ---- rooms ----------------------------------------------------------- */
  const [rosterSearch, setRosterSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [rosterPage, setRosterPage] = useState(1);
  const [reissued, setReissued] = useState<ReceiptData | null>(null);

  /* ---- pickup ---------------------------------------------------------- */
  const [pickupCode, setPickupCode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [guardian, setGuardian] = useState("");
  const [identity, setIdentity] = useState(false);
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState("");

  /* ---- supervisor ------------------------------------------------------ */
  const [kiosks, setKiosks] = useState<KioskLink[]>([]);
  const [kioskLabel, setKioskLabel] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  /* ---- data ------------------------------------------------------------ */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiGet<ChildSession>(`/children/sessions/${initial._id}`);
      setSession(data);
      setUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [initial._id]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh().catch(() => setError(t("errors.refresh")));
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, t]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void apiGet<{ _id: string; name: string }[]>(
        `/children/sessions/${s._id}/families?search=${encodeURIComponent(query)}`,
      )
        .then((rows) => {
          if (active) setResults(rows);
        })
        .catch(() => {
          if (active) setError(t("errors.search"));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, s._id, t]);

  const act = useCallback(
    async (fn: () => Promise<void>) => {
      setError("");
      setNotice("");
      setBusy(true);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.unknownError"));
      } finally {
        setBusy(false);
      }
    },
    [refresh, t],
  );

  const scanCard = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      await act(async () => {
        const found = await apiPost<FamilySelection>(
          `/children/sessions/${s._id}/scan`,
          { code: value },
        );
        setSelection(found);
        setReceipt(null);
        setCardCode("");
      });
    },
    [act, s._id],
  );

  /* Deep link: /children/sessions/:id?code=XYZ scans the card once, then tidies the URL. */
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!deepCode || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    setTimeout(() => {
      setTab("checkin");
      void scanCard(deepCode);
      router.replace(`${pathname}?tab=checkin`, { scroll: false });
    }, 0);
  }, [deepCode, pathname, router, scanCard]);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setNotice("");
    setPending(null);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  }
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const visible = TABS.filter((key) => key !== "supervisor" || s.canManage);
    const index = visible.indexOf(tab);
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = visible[(index + delta + visible.length) % visible.length];
    switchTab(next);
    (
      e.currentTarget.querySelector(
        `[data-tab="${next}"]`,
      ) as HTMLButtonElement | null
    )?.focus();
  }

  /* ---- derived --------------------------------------------------------- */
  const present = s.visits.filter((v) => v.status === "checked_in");
  const presentIn = (roomId: string) =>
    present.filter((v) => v.roomId === roomId).length;
  const roomName = (roomId: string) =>
    s.rooms.find((r) => r.id === roomId)?.name || "";
  const roomTone = (roomId: string) =>
    ROOM_TONES[Math.max(0, s.rooms.findIndex((r) => r.id === roomId)) % ROOM_TONES.length];
  const phase = phaseOf(s, present.length, now);
  const roomsWithSpace = s.rooms.filter((r) => presentIn(r.id) < r.capacity).length;
  const chosen = present.filter((v) => selected.includes(v.id));
  const adults =
    chosen[0]?.authorizedPickup.filter((g) =>
      chosen.every((v) => v.authorizedPickup.some((a) => a.id === g.id)),
    ) || [];
  const visible = present.filter(
    (v) =>
      (!roomFilter || v.roomId === roomFilter) &&
      v.childName.toLowerCase().includes(rosterSearch.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(rosterPage, pages);
  const kbd = (chunks: ReactNode) => <kbd className="kids-kbd">{chunks}</kbd>;

  /* ---- actions --------------------------------------------------------- */
  function nextFamily() {
    setReceipt(null);
    setSelection(null);
    setSearch("");
    setResults([]);
    setNotice("");
    setTimeout(() => scanInput.current?.focus(), 0);
  }
  async function openFamily(familyId: string) {
    await act(async () => {
      setSelection(
        await apiGet<FamilySelection>(
          `/children/sessions/${s._id}/families/${familyId}`,
        ),
      );
      setReceipt(null);
    });
  }
  async function verifyPickup(code: string) {
    const value = code.trim();
    if (!value) return;
    await act(async () => {
      const r = await apiPost<{ visitIds: string[] }>(
        `/children/sessions/${s._id}/pickup`,
        { code: value },
      );
      setSelected(r.visitIds);
      setGuardian("");
      setIdentity(false);
    });
  }
  async function checkout(e: FormEvent) {
    e.preventDefault();
    const adultName = adults.find((g) => g.id === guardian)?.name || "";
    const count = selected.length;
    await act(async () => {
      await apiPost(`/children/sessions/${s._id}/check-out`, {
        visitIds: selected,
        guardianId: guardian,
        identityConfirmed: identity,
        expectedRevision: s.revision,
        ...(exception
          ? { exceptionReason: reason.trim() }
          : { pickupCode: pickupCode.trim() }),
      });
      setSelected([]);
      setPickupCode("");
      setGuardian("");
      setIdentity(false);
      setReason("");
      setNotice(t("pickup.success", { count, name: adultName }));
    });
  }
  async function supervise(job: Pending, note: string) {
    await act(async () => {
      const body =
        job.action === "close"
          ? { action: "close", reason: note, expectedRevision: s.revision }
          : {
              action: job.action,
              visitId: job.visit.id,
              roomId: job.action === "transfer" ? job.room.id : undefined,
              reason: note,
              expectedRevision: s.revision,
            };
      const r = await apiPost<ReceiptData | { closed?: boolean }>(
        `/children/sessions/${s._id}/action`,
        body,
      );
      if (job.action === "reissue") setReissued(r as ReceiptData);
      if (job.action === "close") setKiosks([]);
      setPending(null);
      setNotice(
        job.action === "close"
          ? t("supervisor.close.done")
          : t("supervisor.reason.recorded"),
      );
    });
  }
  async function createKiosk(e: FormEvent) {
    e.preventDefault();
    const label = kioskLabel.trim() || t("supervisor.kiosk.title");
    await act(async () => {
      const k = await apiPost<{ token: string; expiresAt: string }>(
        `/children/sessions/${s._id}/kiosks`,
        { label },
      );
      setKiosks((rows) => [{ ...k, label }, ...rows]);
      setKioskLabel("");
    });
  }
  async function revokeKiosks() {
    await act(async () => {
      await apiPost(`/children/sessions/${s._id}/kiosks/revoke`, {});
      setKiosks([]);
      setNotice(t("supervisor.kiosk.revoked"));
    });
  }
  function exportRoster() {
    const rows = [
      [
        t("supervisor.export.columns.child"),
        t("supervisor.export.columns.room"),
        t("supervisor.export.columns.status"),
        t("supervisor.export.columns.checkedIn"),
        t("supervisor.export.columns.broughtBy"),
        t("supervisor.export.columns.checkedOut"),
        t("supervisor.export.columns.collectedBy"),
      ],
      ...s.visits.map((v) => [
        v.childName,
        roomName(v.roomId),
        v.status,
        v.checkedInAt,
        v.broughtByName,
        v.checkedOutAt || "",
        v.collectedByName || "",
      ]),
    ];
    const csv =
      "﻿" +
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.name.replace(/[^\w-]+/g, "-") || "children"}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function kioskUrl(token: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/children-kiosk/${token}`;
  }

  /* ---- render ---------------------------------------------------------- */
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "checkin", label: t("tabs.checkin") },
    { key: "rooms", label: t("tabs.rooms"), count: present.length },
    {
      key: "pickup",
      label: t("tabs.pickup"),
      count: chosen.length || undefined,
    },
    ...(s.canManage
      ? [{ key: "supervisor" as Tab, label: t("tabs.supervisor") }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="children-panel">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="children-kicker">{t("header.kicker")}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {s.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`children-badge ${PHASE_BADGE[phase]}`}>
                <span
                  className={`kids-live-dot ${PHASE_DOT[phase]}`}
                  aria-hidden="true"
                />
                {t(`header.phase.${phase}`)}
              </span>
              <span className="children-muted">
                <ChildrenLocalTime value={s.startsAt} /> –{" "}
                <ChildrenLocalTime value={s.endsAt} format="time" />
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-[#8a9589]">
            <button
              type="button"
              className="children-button secondary"
              onClick={() =>
                void refresh().catch(() => setError(t("errors.refresh")))
              }
              disabled={refreshing}
            >
              <span aria-hidden="true">↻</span>{" "}
              {refreshing ? t("common.refreshing") : t("common.refresh")}
            </button>
            <span aria-live="polite">
              {updatedAt &&
                t("common.updated", {
                  time: format.dateTime(updatedAt, {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                })}
            </span>
          </div>
        </div>
        {phase === "overdue" && (
          <p className="kids-banner mt-4" role="status">
            {t("header.overdueHint", { count: present.length })}
          </p>
        )}
        <div className="kids-stats mt-6">
          <Stat
            tone="green"
            value={present.length}
            label={t("header.stats.here")}
            hint={t("header.stats.hereHint")}
          />
          <Stat
            tone="blue"
            value={s.visits.length}
            label={t("header.stats.attended")}
            hint={t("header.stats.attendedHint")}
          />
          <Stat
            tone="plum"
            value={s.visits.length - present.length}
            label={t("header.stats.collected")}
            hint={t("header.stats.collectedHint")}
          />
          <Stat
            tone="amber"
            value={s.rooms.length}
            label={t("header.stats.rooms")}
            hint={t("header.stats.roomsHint", { open: roomsWithSpace })}
          />
          {s.canManage && (
            <Stat
              tone=""
              value={kiosks.length}
              label={t("header.stats.kiosks")}
              hint={t("header.stats.kiosksHint")}
            />
          )}
        </div>
        <div
          className="children-tabs mt-6"
          role="tablist"
          aria-label={t("tabs.label")}
          onKeyDown={onTabKey}
        >
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              data-tab={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => switchTab(key)}
            >
              {label}
              {count !== undefined && (
                <span className="kids-tab-count">{count}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="children-error kids-fade-in">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="children-notice kids-fade-in">
          {notice}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* A · Check-in                                                     */}
      {/* ---------------------------------------------------------------- */}
      {tab === "checkin" && s.status !== "open" && (
        <div className="kids-banner amber">
          <strong>{t("closedBanner.title")}</strong>
          <span>{t("closedBanner.body")}</span>
        </div>
      )}
      {tab === "checkin" && s.status === "open" && (
        <div className="children-grid items-start">
          <div className="space-y-5">
            <form
              className="children-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void scanCard(cardCode);
              }}
              aria-busy={busy}
            >
              <p className="children-kicker">{t("checkin.kicker")}</p>
              <h2 className="mt-2 text-2xl font-bold">{t("checkin.title")}</h2>
              <p className="children-muted my-4">{t("checkin.intro")}</p>
              <label className="children-label" htmlFor="child-card">
                {t("checkin.cardLabel")}
              </label>
              <input
                ref={scanInput}
                id="child-card"
                name="code"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="children-input lg font-mono"
                placeholder={t("checkin.placeholder")}
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value)}
                required
              />
              <p className="children-muted mt-2">
                {t.rich("checkin.hint", { kbd })}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="children-button lg"
                  disabled={busy || !cardCode.trim()}
                >
                  {busy ? t("common.working") : t("checkin.find")}
                </button>
                <CameraScan
                  label={t("checkin.camera")}
                  className="children-button secondary lg"
                  onCode={(code) => void scanCard(code)}
                />
              </div>
            </form>
            <section className="children-panel">
              <p className="children-kicker">{t("checkin.searchKicker")}</p>
              <h2 className="mt-2 text-lg font-bold">{t("checkin.searchTitle")}</h2>
              <p className="children-muted mt-1">{t("checkin.searchIntro")}</p>
              <input
                className="children-input mt-4"
                type="search"
                aria-label={t("checkin.searchLabel")}
                placeholder={t("checkin.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setResults([]);
                  setSearching(e.target.value.trim().length >= 2);
                }}
              />
              {search.trim().length >= 2 && (
                <div className="mt-3" aria-live="polite">
                  {searching ? (
                    <p className="children-muted p-3">{t("checkin.searching")}</p>
                  ) : results.length ? (
                    results.map((family) => (
                      <button
                        key={family._id}
                        type="button"
                        className="kids-row w-full rounded-xl text-left hover:bg-[#fafaf4]"
                        disabled={busy}
                        onClick={() => void openFamily(family._id)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="kids-avatar green" aria-hidden="true">
                            {family.name.trim().slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate font-semibold">
                            {family.name}
                          </span>
                        </span>
                        <span className="children-badge neutral">
                          {t("checkin.open")} →
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="children-muted p-3">
                      {t("checkin.noResults", { query: search.trim() })}
                    </p>
                  )}
                </div>
              )}
              {s.canManage && (
                <Link
                  href={`/children/families/new?branchId=${s.branchId}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#245b4b] underline-offset-4 hover:underline"
                >
                  <span aria-hidden="true">✦</span> {t("checkin.register")}
                </Link>
              )}
            </section>
          </div>
          {receipt ? (
            <div className="space-y-4">
              <p role="status" className="children-notice">
                {t("checkin.success", { count: receipt.children.length })}
              </p>
              <ChildrenReceipt data={receipt} onDone={nextFamily} />
            </div>
          ) : selection ? (
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
                setError("");
                await refresh();
              }}
            />
          ) : (
            <Empty
              icon="☀"
              title={t("checkin.readyTitle")}
              body={t("checkin.readyBody")}
            />
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* B · Rooms                                                        */}
      {/* ---------------------------------------------------------------- */}
      {tab === "rooms" && (
        <div className="space-y-5">
          {reissued && (
            <ChildrenReceipt data={reissued} onDone={() => setReissued(null)} />
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.rooms.map((r) => {
              const count = presentIn(r.id);
              const pct = r.capacity ? Math.round((count / r.capacity) * 100) : 0;
              const meter = pct >= 100 ? "full" : pct >= 80 ? "warm" : "";
              const active = roomFilter === r.id;
              return (
                <button
                  type="button"
                  key={r.id}
                  aria-pressed={active}
                  onClick={() => {
                    setRoomFilter(active ? "" : r.id);
                    setRosterPage(1);
                  }}
                  className={`children-panel children-room text-left ${
                    active ? "outline outline-2 outline-[#245b4b]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold">{r.name}</h2>
                    {pct >= 100 ? (
                      <span className="children-badge rose">{t("rooms.full")}</span>
                    ) : (
                      <span className="children-badge">
                        {t("rooms.spacesLeft", { count: r.capacity - count })}
                      </span>
                    )}
                  </div>
                  <p className="children-muted mt-1">
                    {t("rooms.ageRange", {
                      from: ageLabel(t, r.minMonths),
                      to: ageLabel(t, r.maxMonths),
                    })}
                    <span className="text-xs">
                      {" "}
                      · {t("rooms.monthsHint", { min: r.minMonths, max: r.maxMonths })}
                    </span>
                  </p>
                  <p className="mt-4 text-4xl font-bold tabular-nums">
                    {count}
                    <span className="text-lg font-normal text-[#7a8978]">
                      {" "}
                      {t("rooms.ofCapacity", { capacity: r.capacity })}
                    </span>
                  </p>
                  <div
                    className={`kids-meter mt-3 ${meter}`}
                    role="meter"
                    aria-label={r.name}
                    aria-valuemin={0}
                    aria-valuemax={r.capacity}
                    aria-valuenow={count}
                  >
                    <span style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="children-panel">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                aria-label={t("rooms.searchLabel")}
                className="children-input max-w-sm"
                placeholder={t("rooms.searchPlaceholder")}
                value={rosterSearch}
                onChange={(e) => {
                  setRosterSearch(e.target.value);
                  setRosterPage(1);
                }}
              />
              <select
                className="children-input max-w-xs"
                aria-label={t("rooms.filterLabel")}
                value={roomFilter}
                onChange={(e) => {
                  setRoomFilter(e.target.value);
                  setRosterPage(1);
                }}
              >
                <option value="">{t("rooms.showAll")}</option>
                {s.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {presentIn(r.id)}
                  </option>
                ))}
              </select>
              <span className="children-muted ml-auto">
                {t("rooms.showing", { count: visible.length })}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {visible
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((v) => (
                  <article
                    key={v.id}
                    className="kids-fade-in rounded-2xl border border-[#e4e7da] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <ChildrenPortrait url={v.photoUrl} name={v.childName} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold">{v.childName}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <span className={`children-badge ${roomTone(v.roomId)}`}>
                            {roomName(v.roomId)}
                          </span>
                          <span className="children-muted">
                            {durationLabel(t, v.checkedInAt, now)}
                          </span>
                          <span className="children-muted">
                            · {t("rooms.broughtBy", { name: v.broughtByName })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="children-kicker">{t("rooms.code")}</p>
                        <p className="font-mono text-2xl font-bold tracking-widest">
                          {v.pickupDisplay}
                        </p>
                      </div>
                    </div>
                    {(v.careNotes || v.pickupNotes) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.careNotes && (
                          <details className="w-full">
                            <summary className="children-badge rose cursor-pointer">
                              <span aria-hidden="true">♥</span> {t("rooms.careAlert")}
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#fff1ec] p-3 text-sm">
                              <strong className="block text-xs uppercase tracking-wide text-[#8f3a2b]">
                                {t("rooms.careNotes")}
                              </strong>
                              {v.careNotes}
                            </p>
                          </details>
                        )}
                        {v.pickupNotes && (
                          <details className="w-full">
                            <summary className="children-badge amber cursor-pointer">
                              <span aria-hidden="true">✎</span> {t("rooms.pickupNotes")}
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#fff7e6] p-3 text-sm">
                              {v.pickupNotes}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                    {s.canManage && s.status === "open" && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <select
                          aria-label={t("rooms.transfer", { name: v.childName })}
                          className="children-input max-w-xs"
                          value=""
                          disabled={busy}
                          onChange={(e) => {
                            const room = s.rooms.find((r) => r.id === e.target.value);
                            if (room) setPending({ action: "transfer", visit: v, room });
                          }}
                        >
                          <option value="">{t("rooms.transferHint")}</option>
                          {s.rooms
                            .filter((r) => r.id !== v.roomId)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} · {presentIn(r.id)}/{r.capacity}
                              </option>
                            ))}
                        </select>
                        <button
                          className="children-button secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => setPending({ action: "reissue", visit: v })}
                        >
                          {t("rooms.reissue")}
                        </button>
                      </div>
                    )}
                    {pending &&
                      pending.action !== "close" &&
                      pending.visit.id === v.id && (
                        <ReasonForm
                          key={pending.action}
                          title={
                            pending.action === "transfer"
                              ? t("supervisor.reason.transferTitle", {
                                  name: v.childName,
                                  room: pending.room.name,
                                })
                              : t("supervisor.reason.reissueTitle", {
                                  name: v.childName,
                                })
                          }
                          body={
                            pending.action === "transfer"
                              ? t("supervisor.reason.transferBody")
                              : t("supervisor.reason.reissueBody")
                          }
                          confirmLabel={t("supervisor.reason.confirm")}
                          busy={busy}
                          onCancel={() => setPending(null)}
                          onConfirm={(note) => void supervise(pending, note)}
                        />
                      )}
                  </article>
                ))}
              {!visible.length && (
                <div className="kids-empty">
                  <span className="kids-empty-icon" aria-hidden="true">
                    🧸
                  </span>
                  <p className="text-lg font-semibold text-[#203733]">
                    {t("rooms.emptyTitle")}
                  </p>
                  <p>{t("rooms.emptyBody")}</p>
                </div>
              )}
            </div>
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>{t("common.pageOf", { page, pages })}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="children-button secondary"
                    disabled={page === 1}
                    onClick={() => setRosterPage(page - 1)}
                  >
                    ← {t("common.previous")}
                  </button>
                  <button
                    type="button"
                    className="children-button secondary"
                    disabled={page === pages}
                    onClick={() => setRosterPage(page + 1)}
                  >
                    {t("common.next")} →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* C · Pickup                                                       */}
      {/* ---------------------------------------------------------------- */}
      {tab === "pickup" && (
        <div className="children-grid items-start">
          <div className="space-y-5">
            <form
              className="children-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyPickup(pickupCode);
              }}
              aria-busy={busy}
            >
              <p className="children-kicker">{t("pickup.kicker")}</p>
              <h2 className="mt-2 text-2xl font-bold">{t("pickup.title")}</h2>
              <p className="children-muted my-4">{t("pickup.intro")}</p>
              <label className="children-label" htmlFor="pickup-scan">
                {t("pickup.codeLabel")}
              </label>
              <input
                id="pickup-scan"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="children-input lg font-mono"
                value={pickupCode}
                onChange={(e) => {
                  setPickupCode(e.target.value);
                  setSelected([]);
                  setIdentity(false);
                }}
                placeholder={t("pickup.placeholder")}
                required={!exception}
              />
              <p className="children-muted mt-2">{t.rich("pickup.hint", { kbd })}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="children-button lg"
                  disabled={busy || !pickupCode.trim()}
                >
                  {busy ? t("common.working") : t("pickup.verify")}
                </button>
                <CameraScan
                  className="children-button secondary lg"
                  onCode={(code) => {
                    setPickupCode(code);
                    void verifyPickup(code);
                  }}
                />
              </div>
            </form>
            {s.canManage && (
              <section className="children-panel">
                <p className="children-kicker">{t("pickup.exceptionTitle")}</p>
                <label className="mt-3 flex items-start gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-[#245b4b]"
                    checked={exception}
                    onChange={(e) => {
                      setException(e.target.checked);
                      setSelected([]);
                      setGuardian("");
                      setIdentity(false);
                    }}
                  />
                  <span>{t("pickup.exceptionToggle")}</span>
                </label>
                {exception && (
                  <div className="kids-fade-in mt-4 space-y-3">
                    <p className="children-muted">{t("pickup.exceptionIntro")}</p>
                    <label className="block">
                      <span className="children-label">{t("pickup.chooseChild")}</span>
                      <select
                        className="children-input"
                        value={selected[0] || ""}
                        onChange={(e) => {
                          setSelected(e.target.value ? [e.target.value] : []);
                          setGuardian("");
                          setIdentity(false);
                        }}
                      >
                        <option value="">{t("pickup.choosePlaceholder")}</option>
                        {present.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.childName} · {roomName(v.roomId)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="children-label">{t("pickup.reasonLabel")}</span>
                      <textarea
                        className="children-input min-h-24"
                        placeholder={t("pickup.reasonPlaceholder")}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        minLength={MIN_REASON}
                      />
                    </label>
                    {reason.length > 0 && reason.trim().length < MIN_REASON && (
                      <p className="text-xs text-[#8a9589]">
                        {t("pickup.reasonShort", {
                          count: MIN_REASON - reason.trim().length,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
          {chosen.length > 0 ? (
            <form
              onSubmit={checkout}
              className="children-panel kids-fade-in space-y-5"
              aria-busy={busy}
            >
              <div>
                <h2 className="text-2xl font-bold">{t("pickup.matchedTitle")}</h2>
                <p className="children-muted mt-1">
                  {t("pickup.matchedIntro", { count: chosen.length })}
                </p>
              </div>
              <div className="space-y-3">
                {chosen.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 rounded-2xl bg-[#f6f7ee] p-4"
                  >
                    <ChildrenPortrait url={v.photoUrl} name={v.childName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{v.childName}</p>
                      <p className="children-muted">
                        {roomName(v.roomId)} · {durationLabel(t, v.checkedInAt, now)}
                      </p>
                      {v.pickupNotes && (
                        <p className="mt-2 rounded-xl bg-[#fff7e6] p-2 text-sm font-semibold text-[#6e4511]">
                          {v.pickupNotes}
                        </p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="h-6 w-6 accent-[#245b4b]"
                      checked
                      aria-label={t("pickup.remove", { name: v.childName })}
                      onChange={() => {
                        setSelected((ids) => ids.filter((id) => id !== v.id));
                        setGuardian("");
                        setIdentity(false);
                      }}
                    />
                  </div>
                ))}
              </div>
              <label className="block">
                <span className="children-label">{t("pickup.adultLabel")}</span>
                <select
                  className="children-input lg"
                  value={guardian}
                  onChange={(e) => {
                    setGuardian(e.target.value);
                    setIdentity(false);
                  }}
                  required
                >
                  <option value="">{t("pickup.adultPlaceholder")}</option>
                  {adults.map((g) => (
                    <option key={g.id} value={g.id}>
                      {t("pickup.adultOption", {
                        name: g.name,
                        relationship: g.relationship,
                      })}
                    </option>
                  ))}
                </select>
              </label>
              {!adults.length && (
                <p className="children-error">{t("pickup.noAdult")}</p>
              )}
              {guardian && (
                <p className="children-badge blue">
                  <span aria-hidden="true">☎</span>{" "}
                  {t("pickup.phone", {
                    phone: adults.find((g) => g.id === guardian)?.phone || "—",
                  })}
                </p>
              )}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-[#245b4b]"
                  checked={identity}
                  onChange={(e) => setIdentity(e.target.checked)}
                  required
                />
                {t("pickup.identity")}
              </label>
              <button
                className="children-button lg w-full"
                disabled={
                  busy ||
                  !identity ||
                  !guardian ||
                  (exception && reason.trim().length < MIN_REASON)
                }
              >
                {busy ? t("pickup.recording") : t("pickup.confirm")}
              </button>
            </form>
          ) : (
            <Empty
              icon="🔎"
              title={t("pickup.emptyTitle")}
              body={t("pickup.emptyBody")}
            />
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Supervisor                                                       */}
      {/* ---------------------------------------------------------------- */}
      {tab === "supervisor" && s.canManage && (
        <div className="space-y-5">
          <section className="children-panel">
            <p className="children-kicker">{t("tabs.supervisor")}</p>
            <h2 className="mt-2 text-2xl font-bold">{t("supervisor.title")}</h2>
            <p className="children-muted mt-1">{t("supervisor.intro")}</p>
          </section>
          <div className="kids-split items-start">
            <div className="space-y-5">
              {/* Kiosk links */}
              <section className="children-panel">
                <h3 className="text-lg font-bold">
                  <span aria-hidden="true">📱</span> {t("supervisor.kiosk.title")}
                </h3>
                <p className="children-muted mt-1">{t("supervisor.kiosk.intro")}</p>
                <form
                  onSubmit={createKiosk}
                  className="mt-4 flex flex-wrap items-end gap-3"
                >
                  <label className="min-w-[200px] flex-1">
                    <span className="children-label">
                      {t("supervisor.kiosk.labelField")}
                    </span>
                    <input
                      className="children-input"
                      value={kioskLabel}
                      maxLength={60}
                      placeholder={t("supervisor.kiosk.labelPlaceholder")}
                      onChange={(e) => setKioskLabel(e.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    className="children-button"
                    disabled={busy || s.status !== "open"}
                  >
                    {t("supervisor.kiosk.create")}
                  </button>
                  <button
                    type="button"
                    className="children-button danger"
                    disabled={busy}
                    onClick={() => void revokeKiosks()}
                  >
                    {t("supervisor.kiosk.revoke")}
                  </button>
                </form>
                {kiosks.length ? (
                  <ul className="mt-4 space-y-3">
                    {kiosks.map((k) => (
                      <li
                        key={k.token}
                        className="kids-fade-in flex flex-wrap items-center gap-5 rounded-2xl bg-[#f3f5e9] p-4"
                      >
                        <ChildrenQr code={kioskUrl(k.token)} size={120} alt={k.label} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{k.label}</p>
                          <p className="text-xs text-[#8a9589]">
                            {t("supervisor.kiosk.linkTitle")}
                          </p>
                          <p className="children-muted mt-1">
                            {t("supervisor.kiosk.scanHint")}
                          </p>
                          <a
                            href={`/children-kiosk/${k.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block break-all font-mono text-xs underline"
                          >
                            {kioskUrl(k.token)}
                          </a>
                          <p className="children-muted mt-1">
                            {t.rich("supervisor.kiosk.expires", {
                              time: () => <ChildrenLocalTime value={k.expiresAt} />,
                            })}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={`/children-kiosk/${k.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="children-button secondary"
                            >
                              {t("supervisor.kiosk.open")} ↗
                            </a>
                            <button
                              type="button"
                              className="children-button secondary"
                              onClick={() =>
                                void navigator.clipboard
                                  ?.writeText(kioskUrl(k.token))
                                  .then(() => setNotice(t("supervisor.kiosk.copied")))
                              }
                            >
                              {t("supervisor.kiosk.copy")}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="children-muted mt-4">{t("supervisor.kiosk.empty")}</p>
                )}
              </section>

              {/* Export */}
              <section className="children-panel">
                <h3 className="text-lg font-bold">
                  <span aria-hidden="true">⬇</span> {t("supervisor.export.title")}
                </h3>
                <p className="children-muted mt-1">{t("supervisor.export.intro")}</p>
                <button
                  type="button"
                  className="children-button secondary mt-4"
                  onClick={exportRoster}
                >
                  {t("supervisor.export.button")}
                </button>
              </section>

              {/* Close */}
              <section className="children-panel">
                <h3 className="text-lg font-bold">
                  <span aria-hidden="true">🔒</span> {t("supervisor.close.title")}
                </h3>
                <p className="children-muted mt-1">{t("supervisor.close.intro")}</p>
                {s.status !== "open" ? (
                  <p className="children-badge neutral mt-4">
                    {t("supervisor.close.alreadyClosed")}
                  </p>
                ) : present.length > 0 ? (
                  <p className="kids-banner amber mt-4" role="status">
                    {t("supervisor.close.blocked", { count: present.length })}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="children-button danger lg mt-4"
                  disabled={busy || present.length > 0 || s.status !== "open"}
                  aria-disabled={present.length > 0 || s.status !== "open"}
                  onClick={() => setPending({ action: "close" })}
                >
                  {t("supervisor.close.button")}
                </button>
                {pending?.action === "close" && (
                  <ReasonForm
                    title={t("supervisor.reason.closeTitle")}
                    body={t("supervisor.reason.closeBody")}
                    confirmLabel={t("supervisor.close.button")}
                    danger
                    busy={busy}
                    onCancel={() => setPending(null)}
                    onConfirm={(note) => void supervise(pending, note)}
                  />
                )}
              </section>
            </div>

            <div className="space-y-5">
              {/* Session details */}
              <section className="children-panel">
                <h3 className="text-lg font-bold">{t("supervisor.info.title")}</h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="children-muted">{t("supervisor.info.starts")}</dt>
                  <dd>
                    <ChildrenLocalTime value={s.startsAt} />
                  </dd>
                  <dt className="children-muted">{t("supervisor.info.ends")}</dt>
                  <dd>
                    <ChildrenLocalTime value={s.endsAt} />
                  </dd>
                  <dt className="children-muted">{t("supervisor.info.status")}</dt>
                  <dd>{t(`header.phase.${phase}`)}</dd>
                  <dt className="children-muted">{t("supervisor.info.rooms")}</dt>
                  <dd>{s.rooms.length}</dd>
                  <dt className="children-muted">{t("supervisor.info.capacity")}</dt>
                  <dd>{s.rooms.reduce((sum, r) => sum + r.capacity, 0)}</dd>
                  <dt className="children-muted">{t("supervisor.info.revision")}</dt>
                  <dd>{s.revision}</dd>
                  <dt className="children-muted">{t("supervisor.info.events")}</dt>
                  <dd>{s.events.length}</dd>
                </dl>
              </section>

              {/* Timeline */}
              <section className="children-panel">
                <h3 className="text-lg font-bold">{t("supervisor.timeline.title")}</h3>
                {s.events.length ? (
                  <ol className="kids-timeline mt-4 max-h-[36rem] overflow-auto pr-2">
                    {s.events
                      .slice()
                      .reverse()
                      .map((e, i) => {
                        const action = e.action;
                        const known = isTimelineAction(action);
                        return (
                          <li
                            key={`${e.at}-${i}`}
                            className={known ? TIMELINE_TONE[action] || "" : ""}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>
                                {known
                                  ? t(`supervisor.timeline.actions.${action}`)
                                  : action.replaceAll("_", " ")}
                              </strong>
                              {e.childIds?.length ? (
                                <span className="children-badge neutral">
                                  {t("supervisor.timeline.children", {
                                    count: e.childIds.length,
                                  })}
                                </span>
                              ) : null}
                            </div>
                            {e.note && (
                              <p className="mt-1 whitespace-pre-wrap">{e.note}</p>
                            )}
                            <p className="children-muted mt-1 text-xs">
                              <ChildrenLocalTime value={e.at} format="time" /> ·{" "}
                              {e.actorId.startsWith("kiosk:")
                                ? t("supervisor.timeline.kiosk")
                                : t("supervisor.timeline.staff", {
                                    id: e.actorName || e.actorId,
                                  })}
                            </p>
                          </li>
                        );
                      })}
                  </ol>
                ) : (
                  <p className="children-muted mt-3">{t("supervisor.timeline.empty")}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
