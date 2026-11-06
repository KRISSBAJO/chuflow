import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { ChildrenCardButton } from "@/components/children/receipt";
import {
  ageInMonths,
  initials,
  parseDateOnly,
  splitMonths,
} from "@/components/children/records-utils";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const [q, f, t, format] = await Promise.all([
    searchParams,
    serverGet<Family>(`/children/families/${encodeURIComponent(id)}`),
    getTranslations("childrenRecords"),
    getFormatter(),
  ]);
  const age = (birthDate: string) => {
    const m = ageInMonths(birthDate);
    if (m === null) return t("age.unknown");
    if (m === 0) return t("age.newborn");
    const { years, months } = splitMonths(m);
    if (years === 0) return t("age.months", { months });
    if (months === 0) return t("age.years", { years });
    return t("age.yearsMonths", { years, months });
  };
  const born = (value: string) => {
    const d = parseDateOnly(value);
    return d ? format.dateTime(d, { dateStyle: "medium" }) : value;
  };
  const pickupAdults = new Set(f.children.flatMap((c) => c.pickupGuardianIds));
  const tones = ["plum", "blue", "green", ""] as const;
  return (
    <div className="space-y-6 kids-fade-in">
      <Link href="/children" className="kids-chip">
        {t("back.families")}
      </Link>
      {q.saved && (
        <p role="status" className="kids-banner green">
          ✓ {t("familyPage.saved")}
        </p>
      )}

      <section className="children-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="kids-avatar green !h-16 !w-16 !rounded-2xl !text-2xl">
              {initials(f.name)}
            </span>
            <div>
              <p className="children-kicker">{t("familyPage.kicker")}</p>
              <h1 className="mt-1 text-3xl font-bold">{f.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="children-button secondary"
              href={`/children/families/${id}/edit`}
            >
              ✎ {t("familyPage.editGuardians")}
            </Link>
            <Link
              className="children-button"
              href={`/children/families/${id}/new`}
            >
              {t("familyPage.addChild")}
            </Link>
          </div>
        </div>
        <div className="kids-stats mt-6">
          <div className="kids-stat green">
            <span className="kids-stat-value">{f.guardians.length}</span>
            <span className="kids-stat-label">{t("familyPage.statAdults")}</span>
          </div>
          <div className="kids-stat amber">
            <span className="kids-stat-value">{f.children.length}</span>
            <span className="kids-stat-label">{t("familyPage.statChildren")}</span>
          </div>
          <div className="kids-stat blue">
            <span className="kids-stat-value">{pickupAdults.size}</span>
            <span className="kids-stat-label">{t("familyPage.statPickup")}</span>
            <span className="kids-stat-hint">{t("familyPage.statPickupHint")}</span>
          </div>
          <div className="kids-stat plum">
            <span className="kids-stat-value">
              {f.children.filter((c) => c.isMember).length}
            </span>
            <span className="kids-stat-label">{t("familyPage.statMembers")}</span>
          </div>
        </div>
      </section>

      <section className="children-panel">
        <h2 className="text-2xl font-bold">{t("familyPage.adults")}</h2>
        {f.guardians.length ? (
          <div className="mt-5 children-grid">
            {f.guardians.map((g, i) => (
              <div key={g.id} className="flex gap-3 rounded-xl bg-[#f5f7ef] p-4">
                <span className={`kids-avatar ${tones[i % tones.length]}`}>
                  {initials(`${g.firstName} ${g.lastName}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {g.firstName} {g.lastName}
                  </p>
                  <p className="children-muted">
                    <a className="underline" href={`tel:${g.phone}`}>
                      {g.phone}
                    </a>
                    {g.email && (
                      <>
                        {" · "}
                        <a className="underline break-all" href={`mailto:${g.email}`}>
                          {g.email}
                        </a>
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="children-badge neutral">{g.relationship}</span>
                    <span className={`children-badge ${g.canCheckIn ? "" : "amber"}`}>
                      {g.canCheckIn
                        ? `✓ ${t("familyPage.mayCheckIn")}`
                        : t("familyPage.contactOnly")}
                    </span>
                    {pickupAdults.has(g.id) && (
                      <span className="children-badge blue">
                        🔑 {t("familyPage.statPickup")}
                      </span>
                    )}
                    {g.memberId && (
                      <span className="children-badge plum">
                        {t("familyPage.memberLinked")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="kids-empty mt-5">
            <span className="kids-empty-icon" aria-hidden="true">
              👋
            </span>
            <strong>{t("familyPage.noAdults")}</strong>
            <span>{t("familyPage.noAdultsHint")}</span>
          </div>
        )}
        <div className="mt-6 rounded-xl border border-dashed border-[#d8dccd] p-4">
          <p className="font-semibold">🪪 {t("familyPage.cards")}</p>
          <p className="children-muted mb-3">{t("familyPage.cardsHint")}</p>
          <ChildrenCardButton kind="family" id={id} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{t("familyPage.children")}</h2>
          <Link className="children-button" href={`/children/families/${id}/new`}>
            {t("familyPage.addChild")}
          </Link>
        </div>
        {f.children.map((c) => {
          const pickup = f.guardians.filter((g) => c.pickupGuardianIds.includes(g.id));
          return (
            <section key={c._id} className="children-panel children-room">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="kids-avatar plum !h-14 !w-14 !text-xl">
                    {initials(`${c.firstName} ${c.lastName}`)}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">
                      {c.firstName} {c.lastName}
                    </h3>
                    <p className="children-muted">
                      {age(c.birthDate)} ·{" "}
                      {t("familyPage.born", { date: born(c.birthDate) })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`children-badge ${c.isMember ? "" : "blue"}`}>
                    {c.isMember ? t("familyPage.childMember") : t("familyPage.visitor")}
                  </span>
                  <span className={`children-badge ${c.isActive ? "neutral" : "rose"}`}>
                    {c.isActive ? t("familyPage.active") : t("familyPage.inactive")}
                  </span>
                  {c.careNotes && (
                    <span className="children-badge rose">⚕ {t("familyPage.careAlert")}</span>
                  )}
                  {c.photoConsent && (
                    <span className="children-badge plum">📷 {t("familyPage.photoOk")}</span>
                  )}
                </div>
              </div>
              <p className="children-label mt-5 !mb-2">{t("familyPage.pickup")}</p>
              <div className="flex flex-wrap gap-2">
                {pickup.length ? (
                  pickup.map((g) => (
                    <span key={g.id} className="kids-chip active">
                      🔑 {g.firstName} {g.lastName}
                      <span className="opacity-75"> · {g.relationship}</span>
                    </span>
                  ))
                ) : (
                  <span className="children-badge rose">{t("familyPage.noPickup")}</span>
                )}
              </div>
              {c.careNotes && (
                <details className="mt-4 rounded-xl bg-[#fff7e6] p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    ⚕ {t("familyPage.careNotes")}
                  </summary>
                  <p className="children-muted mt-2 whitespace-pre-wrap">{c.careNotes}</p>
                </details>
              )}
              {c.pickupNotes && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                  <strong>{t("familyPage.pickupNotes")}:</strong>{" "}
                  <span className="whitespace-pre-wrap">{c.pickupNotes}</span>
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/children/families/${id}/children/${c._id}`}
                  className="children-button secondary"
                >
                  ✎ {t("familyPage.editChild")}
                </Link>
                <ChildrenCardButton kind="child" id={c._id} />
              </div>
            </section>
          );
        })}
        {!f.children.length && (
          <div className="kids-empty">
            <span className="kids-empty-icon" aria-hidden="true">
              🧒
            </span>
            <strong>{t("familyPage.noChildren")}</strong>
            <span>{t("familyPage.noChildrenHint")}</span>
            <Link className="children-button mt-2" href={`/children/families/${id}/new`}>
              {t("familyPage.addChild")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
