import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { ChildrenWelcome } from "@/components/children/welcome";
import { BranchSwitcher } from "@/components/children/branch-switcher";
import { LiveBoard } from "@/components/children/home/live-board";
import { TrendChart } from "@/components/children/home/trend-chart";
import type { AgeBucket, ChildrenOverview } from "@/lib/children";

const AGE_ORDER: AgeBucket[] = ["under3", "3to5", "6to9", "10to12", "teens"];
const AGE_TONE = ["", "", "warm", "warm", "full"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/children");
  const q = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["branchId", "search", "page", "sessionPage"])
    if (q[key]) params.set(key, q[key]!);
  const [data, t, format] = await Promise.all([
    serverGet<ChildrenOverview>(`/children?${params}`),
    getTranslations("children.home"),
    getFormatter(),
  ]);
  const tp = await getTranslations("children.phase");
  const branchId = data.branchId || "";
  const href = (key: "page" | "sessionPage", page: number) => {
    const next = new URLSearchParams(params);
    next.set(key, String(page));
    return `/children?${next}`;
  };
  const stats = data.stats;
  const ageTotal = stats
    ? AGE_ORDER.reduce((sum, key) => sum + stats.ageMix[key], 0)
    : 0;
  const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();
  const tones = ["", "green", "blue", "plum"];

  if (!data.branches.length) {
    return (
      <>
        <ChildrenWelcome />
        <div className="kids-empty">
          <span className="kids-empty-icon" aria-hidden>
            🔒
          </span>
          <p>{t("noAccess")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BranchSwitcher
          branches={data.branches}
          value={branchId}
          label={t("church")}
        />
        {data.branches.length === 1 && (
          <span className="children-badge neutral">{data.branches[0].name}</span>
        )}
        {data.canManage && stats && stats.pendingRegistrations > 0 && (
          <Link
            href={`/children/registrations?branchId=${branchId}`}
            className="kids-chip"
          >
            <span className="kids-live-dot amber" />
            {t("alerts.pending", { count: stats.pendingRegistrations })}
          </Link>
        )}
      </div>

      {data.live ? (
        <LiveBoard
          key={data.live._id}
          initial={data.live}
          branchId={branchId}
          canManage={data.canManage}
        />
      ) : (
        <ChildrenWelcome>
          <div className="mt-6 rounded-2xl bg-white/70 p-4">
            <p className="font-semibold">{t("quiet.title")}</p>
            <p className="children-muted mt-1">
              {data.canManage ? t("quiet.manager") : t("quiet.worker")}
            </p>
            {data.canManage && (
              <Link
                href={`/children/sessions/new?branchId=${branchId}`}
                className="children-button mt-4"
              >
                {t("quiet.cta")}
              </Link>
            )}
          </div>
        </ChildrenWelcome>
      )}

      {stats && (
        <section aria-label={t("stats.title")} className="kids-stats">
          <div className="kids-stat green">
            <span className="kids-stat-value">
              {format.number(stats.children)}
            </span>
            <span className="kids-stat-label">{t("stats.children")}</span>
            <span className="kids-stat-hint">{t("stats.childrenHint")}</span>
          </div>
          <div className="kids-stat">
            <span className="kids-stat-value">
              {format.number(stats.families)}
            </span>
            <span className="kids-stat-label">{t("stats.families")}</span>
            <span className="kids-stat-hint">{t("stats.familiesHint")}</span>
          </div>
          <div className="kids-stat amber">
            <span className="kids-stat-value">
              {format.number(stats.newChildren)}
            </span>
            <span className="kids-stat-label">{t("stats.newChildren")}</span>
            <span className="kids-stat-hint">{t("stats.newHint")}</span>
          </div>
          <div className="kids-stat blue">
            <span className="kids-stat-value">
              {format.number(stats.visiting)}
            </span>
            <span className="kids-stat-label">{t("stats.visiting")}</span>
            <span className="kids-stat-hint">{t("stats.visitingHint")}</span>
          </div>
          {data.canManage && (
            <div className="kids-stat plum">
              <span className="kids-stat-value">
                {format.number(stats.birthdays.length)}
              </span>
              <span className="kids-stat-label">{t("stats.birthdays")}</span>
            </div>
          )}
          {data.canManage && (
            <Link
              href={`/children/registrations?branchId=${branchId}`}
              className={`kids-stat ${stats.pendingRegistrations ? "rose" : ""}`}
            >
              <span className="kids-stat-value">
                {format.number(stats.pendingRegistrations)}
              </span>
              <span className="kids-stat-label">{t("stats.pending")}</span>
              <span className="kids-stat-hint">{t("stats.pendingHint")}</span>
            </Link>
          )}
        </section>
      )}

      <section className="kids-split">
        <div className="children-panel">
          <h2 className="text-xl font-bold">{t("trend.title")}</h2>
          <p className="children-muted mb-4">{t("trend.subtitle")}</p>
          <TrendChart points={data.trend} />
        </div>
        <div className="space-y-5">
          <div className="children-panel">
            <h2 className="text-xl font-bold">{t("ages.title")}</h2>
            <p className="children-muted mb-4">{t("ages.subtitle")}</p>
            {stats && ageTotal > 0 ? (
              <ul className="space-y-3">
                {AGE_ORDER.map((key, index) => {
                  const count = stats.ageMix[key];
                  return (
                    <li key={key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{t(`ages.${key}`)}</span>
                        <span className="tabular-nums text-[#65746a]">
                          {format.number(count)} ·{" "}
                          {format.number(count / ageTotal, {
                            style: "percent",
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                      <div className={`kids-meter mt-1 ${AGE_TONE[index]}`}>
                        <span
                          style={{ width: `${(count / ageTotal) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="children-muted">{t("ages.empty")}</p>
            )}
          </div>
          {data.canManage && stats && (
            <div className="children-panel">
              <h2 className="text-xl font-bold">{t("birthdays.title")}</h2>
              {stats.birthdays.length ? (
                <ul className="mt-3">
                  {stats.birthdays.map((child, index) => (
                    <li key={child._id} className="kids-row">
                      <Link
                        href={`/children/families/${child.familyId}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <span
                          className={`kids-avatar ${tones[index % tones.length]}`}
                        >
                          🎂
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {child.name}
                          </span>
                          <span className="children-muted">
                            {t("birthdays.turning", { age: child.turning })} ·{" "}
                            {format.dateTime(new Date(child.date + "T12:00:00"), {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="children-muted mt-3">{t("birthdays.empty")}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section aria-label={t("actions.title")} className="space-y-3">
        <h2 className="text-xl font-bold">{t("actions.title")}</h2>
        <div className="kids-actions">
          {data.live && (
            <Link
              href={`/children/sessions/${data.live._id}?tab=checkin`}
              className="kids-action"
            >
              <span className="kids-action-icon green" aria-hidden>
                ☀
              </span>
              <strong>{t("actions.desk")}</strong>
              <span className="children-muted">{t("actions.deskHint")}</span>
            </Link>
          )}
          {data.canManage && (
            <Link
              href={`/children/families/new?branchId=${branchId}`}
              className="kids-action"
            >
              <span className="kids-action-icon" aria-hidden>
                👪
              </span>
              <strong>{t("actions.registerFamily")}</strong>
              <span className="children-muted">
                {t("actions.registerFamilyHint")}
              </span>
            </Link>
          )}
          {data.canManage && !data.live && (
            <Link
              href={`/children/sessions/new?branchId=${branchId}`}
              className="kids-action"
            >
              <span className="kids-action-icon blue" aria-hidden>
                🗓
              </span>
              <strong>{t("actions.openSession")}</strong>
              <span className="children-muted">
                {t("actions.openSessionHint")}
              </span>
            </Link>
          )}
          {data.canManage && (
            <Link
              href={`/children/registrations?branchId=${branchId}`}
              className="kids-action"
            >
              <span className="kids-action-icon plum" aria-hidden>
                ✍
              </span>
              <strong>{t("actions.registrations")}</strong>
              <span className="children-muted">
                {t("actions.registrationsHint")}
              </span>
            </Link>
          )}
          {data.canManage && data.live && (
            <Link
              href={`/children/sessions/${data.live._id}?tab=supervisor`}
              className="kids-action"
            >
              <span className="kids-action-icon rose" aria-hidden>
                📱
              </span>
              <strong>{t("actions.kiosk")}</strong>
              <span className="children-muted">{t("actions.kioskHint")}</span>
            </Link>
          )}
          {data.canManage && (
            <a href="#kids-families" className="kids-action">
              <span className="kids-action-icon blue" aria-hidden>
                🔎
              </span>
              <strong>{t("actions.families")}</strong>
              <span className="children-muted">
                {t("actions.familiesHint")}
              </span>
            </a>
          )}
        </div>
      </section>

      {!data.live && (
        <section className="children-steps" aria-label={t("steps.title")}>
          {(["a", "b", "c"] as const).map((step) => (
            <div key={step} className="children-step">
              <strong>{step.toUpperCase()}</strong>
              <h2 className="text-lg font-semibold">{t(`steps.${step}`)}</h2>
              <p className="children-muted mt-2">{t(`steps.${step}Text`)}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t("sessions.title")}</h2>
            <p className="children-muted">
              {t("sessions.subtitle", { count: data.sessionPagination.total })}
            </p>
          </div>
          {data.canManage && !data.live && (
            <Link
              href={`/children/sessions/new?branchId=${branchId}`}
              className="children-button"
            >
              + {t("sessions.new")}
            </Link>
          )}
        </div>
        {data.sessions.length ? (
          <div className="children-grid">
            {data.sessions.map((session) => {
              const phase =
                session.status === "closed"
                  ? "closed"
                  : data.live && data.live._id === session._id
                    ? data.live.phase
                    : "open";
              return (
                <Link
                  key={session._id}
                  href={`/children/sessions/${session._id}`}
                  className="children-panel children-room"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold leading-tight">
                      {session.name}
                    </h3>
                    <span
                      className={`children-badge ${phase === "closed" ? "neutral" : phase === "overdue" ? "rose" : phase === "upcoming" ? "amber" : ""}`}
                    >
                      <span
                        className={`kids-live-dot ${phase === "closed" || phase === "open" ? "still" : phase === "upcoming" ? "amber" : phase === "overdue" ? "rose" : ""}`}
                      />
                      {tp(phase)}
                    </span>
                  </div>
                  <p className="children-muted mt-2">
                    {format.dateTime(new Date(session.startsAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {t("sessions.rooms", { count: session.rooms })}
                  </p>
                  <div className="mt-5 flex gap-8">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">
                        {format.number(session.present)}
                      </p>
                      <p className="children-muted">{t("sessions.hereNow")}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold tabular-nums">
                        {format.number(session.attended)}
                      </p>
                      <p className="children-muted">{t("sessions.attended")}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="kids-empty">
            <span className="kids-empty-icon" aria-hidden>
              🌤
            </span>
            <p>{t("sessions.empty")}</p>
          </div>
        )}
        {data.sessionPagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span>
              {t("sessions.page", {
                page: data.sessionPagination.page,
                total: data.sessionPagination.totalPages,
              })}
            </span>
            <div className="flex gap-2">
              {data.sessionPagination.page > 1 && (
                <Link
                  className="kids-chip"
                  href={href("sessionPage", data.sessionPagination.page - 1)}
                >
                  ← {t("sessions.newer")}
                </Link>
              )}
              {data.sessionPagination.page <
                data.sessionPagination.totalPages && (
                <Link
                  className="kids-chip"
                  href={href("sessionPage", data.sessionPagination.page + 1)}
                >
                  {t("sessions.older")} →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {data.canManage && (
        <section id="kids-families" className="children-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{t("families.title")}</h2>
              <p className="children-muted">
                {t("families.registered", { count: data.pagination.total })}
              </p>
            </div>
            <form className="flex gap-2">
              <input type="hidden" name="branchId" value={branchId} />
              <label className="sr-only" htmlFor="kids-family-search">
                {t("families.search")}
              </label>
              <input
                id="kids-family-search"
                name="search"
                className="children-input !min-h-11 w-64 max-w-full"
                placeholder={t("families.placeholder")}
                defaultValue={q.search}
              />
              <button className="children-button !min-h-11" type="submit">
                {t("families.search")}
              </button>
            </form>
          </div>
          <div className="mt-4">
            {data.families.map((family, index) => (
              <Link
                key={family._id}
                className="kids-row"
                href={`/children/families/${family._id}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`kids-avatar ${tones[index % tones.length]}`}
                  >
                    {initial(family.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {family.name}
                    </span>
                    <span className="children-muted">
                      {t("families.children", { count: family.childCount })} ·{" "}
                      {t("families.guardians", {
                        count: family.guardianCount,
                      })}
                    </span>
                  </span>
                </span>
                <span className="kids-chip">{t("families.open")} →</span>
              </Link>
            ))}
          </div>
          {!data.families.length && (
            <div className="kids-empty mt-4">
              <span className="kids-empty-icon" aria-hidden>
                👋
              </span>
              <p>{t("families.empty")}</p>
            </div>
          )}
          {data.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span>
                {t("families.page", {
                  page: data.pagination.page,
                  total: data.pagination.totalPages,
                })}
              </span>
              <div className="flex gap-2">
                {data.pagination.page > 1 && (
                  <Link
                    className="kids-chip"
                    href={href("page", data.pagination.page - 1)}
                  >
                    ←
                  </Link>
                )}
                {data.pagination.page < data.pagination.totalPages && (
                  <Link
                    className="kids-chip"
                    href={href("page", data.pagination.page + 1)}
                  >
                    →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
