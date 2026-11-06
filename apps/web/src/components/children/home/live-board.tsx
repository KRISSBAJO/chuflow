"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import type { ChildrenOverview, LiveSession } from "@/lib/children";
import { QuickScan } from "./quick-scan";
import { formatAgeRange } from "./age";

const REFRESH_MS = 20_000;

function phaseClass(phase: LiveSession["phase"]) {
  return phase === "upcoming" ? "amber" : phase === "overdue" ? "rose" : "";
}

function eventTone(action: string) {
  if (action === "check_in") return "";
  if (action === "check_out") return "blue";
  if (action === "checkout_exception" || action === "session_closed")
    return "rose";
  if (action === "transfer" || action === "reissue") return "amber";
  return "plum";
}

type EventKey =
  | "session_created"
  | "check_in"
  | "check_out"
  | "checkout_exception"
  | "transfer"
  | "reissue"
  | "session_closed";
const EVENT_KEYS: EventKey[] = [
  "session_created",
  "check_in",
  "check_out",
  "checkout_exception",
  "transfer",
  "reissue",
  "session_closed",
];

/** Live service board: polls the overview every 20 s and renders rooms, counts and recent activity. */
export function LiveBoard({
  initial,
  branchId,
  canManage,
}: {
  initial: LiveSession;
  branchId: string;
  canManage: boolean;
}) {
  const t = useTranslations("children.home.live");
  const tp = useTranslations("children.phase");
  const format = useFormatter();
  const [live, setLive] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await apiGet<ChildrenOverview>(
        `/children?branchId=${encodeURIComponent(branchId)}`,
      );
      if (data.live) setLive(data.live);
      setUpdatedAt(new Date());
    } catch {
      /* keep the last snapshot visible */
    } finally {
      setBusy(false);
    }
  }, [branchId]);

  useEffect(() => {
    const poll = setInterval(() => void refresh(), REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  const starts = new Date(live.startsAt);
  const ends = new Date(live.endsAt);
  const timing =
    live.phase === "upcoming"
      ? t("startsIn", { time: format.relativeTime(starts, now) })
      : ends.getTime() > now
        ? t("endsIn", { time: format.relativeTime(ends, now) })
        : t("endedAgo", { time: format.relativeTime(ends, now) });
  const deskHref = `/children/sessions/${live._id}`;

  return (
    <section className="children-panel kids-fade-in space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="children-kicker">{t("eyebrow")}</p>
          <h2 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-bold leading-tight">
            <span className="truncate">{live.name}</span>
            <span
              className={`children-badge ${live.phase === "overdue" ? "rose" : live.phase === "upcoming" ? "amber" : ""}`}
            >
              <span className={`kids-live-dot ${phaseClass(live.phase)}`} />
              {tp(live.phase)}
            </span>
          </h2>
          <p className="children-muted mt-2">
            {t("window", {
              start: format.dateTime(starts, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              }),
              end: format.dateTime(ends, { hour: "numeric", minute: "2-digit" }),
            })}{" "}
            · {timing}
            {canManage ? ` · ${t("kiosks", { count: live.kiosks })}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${deskHref}?tab=checkin`} className="children-button">
            {t("desk")}
          </Link>
          <Link
            href={`${deskHref}?tab=pickup`}
            className="children-button secondary"
          >
            {t("pickup")}
          </Link>
        </div>
      </div>

      {live.phase === "overdue" && (
        <div className="kids-banner" role="alert">
          <span className="font-semibold">
            {t("overdue", { count: live.present })}
          </span>
          <Link href={`${deskHref}?tab=pickup`} className="children-button">
            {t("pickup")}
          </Link>
        </div>
      )}
      {live.phase === "ending" && (
        <div className="kids-banner green" role="status">
          <span className="font-semibold">{t("allHome")}</span>
          {canManage && (
            <Link
              href={`${deskHref}?tab=supervisor`}
              className="children-button secondary"
            >
              {t("supervisor")}
            </Link>
          )}
        </div>
      )}

      <div className="kids-stats">
        <div className="kids-stat green">
          <span className="kids-stat-value">{format.number(live.present)}</span>
          <span className="kids-stat-label">{t("hereNow")}</span>
        </div>
        <div className="kids-stat">
          <span className="kids-stat-value">
            {format.number(live.attended)}
          </span>
          <span className="kids-stat-label">{t("attended")}</span>
        </div>
        <div className="kids-stat blue">
          <span className="kids-stat-value">
            {format.number(live.collected)}
          </span>
          <span className="kids-stat-label">{t("collected")}</span>
        </div>
        <div className="kids-stat amber">
          <span className="kids-stat-value">
            {format.number(live.rooms.length)}
          </span>
          <span className="kids-stat-label">{t("rooms")}</span>
        </div>
      </div>

      <div className="kids-split">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {live.rooms.map((room) => {
              const ratio = room.capacity ? room.present / room.capacity : 0;
              const tone = ratio >= 1 ? "full" : ratio >= 0.8 ? "warm" : "";
              return (
                <Link
                  key={room.id}
                  href={`${deskHref}?tab=rooms&room=${room.id}`}
                  className="rounded-2xl border border-[#e6e8dd] bg-[#fdfcf7] p-4 transition hover:border-[#cfd6c8] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{room.name}</p>
                      <p className="children-muted">
                        {formatAgeRange(
                          room.minMonths,
                          room.maxMonths,
                          (count) => t("months", { count }),
                          (count) => t("years", { count }),
                        )}
                      </p>
                    </div>
                    <span
                      className={`children-badge ${tone === "full" ? "rose" : tone === "warm" ? "amber" : "neutral"}`}
                    >
                      {tone === "full"
                        ? t("full")
                        : t("spaces", { count: room.capacity - room.present })}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums">
                    {room.present}
                    <span className="text-base font-medium text-[#7a8978]">
                      {" "}
                      / {room.capacity}
                    </span>
                  </p>
                  <div
                    className={`kids-meter mt-2 ${tone}`}
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={room.capacity}
                    aria-valuenow={room.present}
                    aria-label={`${room.name}: ${t("capacity", { present: room.present, capacity: room.capacity })}`}
                  >
                    <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <QuickScan sessionId={live._id} />
        </div>
        <div className="rounded-2xl bg-[#f6f7ee] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">{t("activity")}</h3>
            <button
              type="button"
              className="kids-chip"
              disabled={busy}
              onClick={() => void refresh()}
            >
              {t("refresh")}
            </button>
          </div>
          {live.recent.length ? (
            <ol className="kids-timeline mt-4">
              {live.recent.map((event, index) => {
                const key = EVENT_KEYS.includes(event.action as EventKey)
                  ? (event.action as EventKey)
                  : "other";
                return (
                  <li key={index} className={eventTone(event.action)}>
                    <p className="font-semibold">
                      {t(`events.${key}`, { count: event.count })}
                    </p>
                    <p className="children-muted !text-xs">
                      {format.dateTime(new Date(event.at), {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {event.kiosk ? t("byKiosk") : t("byStaff")}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="children-muted mt-4">{t("noActivity")}</p>
          )}
          {updatedAt && (
            <p className="children-muted mt-2 !text-xs">
              {t("updated", {
                time: format.dateTime(updatedAt, {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
