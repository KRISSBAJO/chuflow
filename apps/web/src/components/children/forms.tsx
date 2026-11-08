"use client";
import { useActionToast } from "@/lib/action-feedback";
import { toast } from "sonner";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  ChildProfile,
  ChildrenOptions,
  Family,
  Guardian,
  LatestRooms,
} from "@/lib/children";
import {
  MAX_MONTHS,
  RELATIONSHIP_KEYS,
  ROOM_TEMPLATES,
  ageInMonths,
  initials,
  localDateValue,
  localTimeValue,
  splitMonths,
} from "./records-utils";

type T = ReturnType<typeof useTranslations<"childrenRecords">>;

/* ---------- shared building blocks ---------------------------------------- */

function Field({
  label,
  hint,
  error,
  descriptionId,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  descriptionId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="children-label">{label}</span>
      {children}
      {(error || hint) && (
        <span id={descriptionId} className={`mt-1 block text-xs ${error ? "text-[#953c2e]" : "children-muted"}`}>
          {error || hint}
        </span>
      )}
    </label>
  );
}

function StepHeading({
  n,
  title,
  description,
  tone = "",
  action,
}: {
  n: number;
  title: string;
  description?: string;
  tone?: "" | "green" | "blue" | "plum";
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`kids-avatar ${tone}`} aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 className="text-xl font-bold leading-tight">{title}</h2>
          {description && <p className="children-muted mt-1">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
  onText,
  offText,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  onText: string;
  offText: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[#f7f7f0] p-4">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="children-muted mt-1">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full px-1 py-1 text-xs font-bold transition-colors ${
          checked ? "bg-[#245b4b] text-white" : "bg-[#dfe3d6] text-[#4b5a4e]"
        }`}
      >
        <span
          className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "order-2" : "order-1"
          }`}
        />
        <span className={`px-2 ${checked ? "order-1" : "order-2"}`}>
          {checked ? onText : offText}
        </span>
      </button>
    </div>
  );
}

function useAgeLabel() {
  const t = useTranslations("childrenRecords");
  return (months: number | null) => {
    if (months === null) return t("age.unknown");
    if (months === 0) return t("age.newborn");
    const { years, months: m } = splitMonths(months);
    if (years === 0) return t("age.months", { months: m });
    if (m === 0) return t("age.years", { years });
    return t("age.yearsMonths", { years, months: m });
  };
}

function RelationshipChips({
  value,
  onPick,
  t,
}: {
  value: string;
  onPick: (label: string) => void;
  t: T;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {RELATIONSHIP_KEYS.map((k) => {
        const label = t(`relationships.${k}`);
        return (
          <button
            key={k}
            type="button"
            className="kids-chip"
            aria-pressed={value.trim().toLowerCase() === label.toLowerCase()}
            onClick={() => onPick(label)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- adult member search ------------------------------------------- */

type AdultMatch = {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

function AdultMemberLink({
  branchId,
  value,
  onChange,
}: {
  branchId: string;
  value?: string;
  onChange: (id: string, person?: AdultMatch) => void;
}) {
  const t = useTranslations("childrenRecords");
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState<AdultMatch[]>([]),
    [loading, setLoading] = useState(false);
  const query = search.trim();
  useEffect(() => {
    let active = true;
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      void apiGet<AdultMatch[]>(
        `/children/adult-members?branchId=${branchId}&search=${encodeURIComponent(query)}`,
      )
        .then((r) => {
          if (active) setRows(r);
        })
        .catch(() => {
          if (active) setRows([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [branchId, query]);
  return (
    <div className="rounded-xl bg-[#f6f7ef] p-3">
      <span className="children-label">
        {t("memberLink.label")}{" "}
        <span className="font-normal text-[#8a9589]">
          ({t("common.optional")})
        </span>
      </span>
      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="children-badge blue">
            ⛓ {t("memberLink.linked")}
          </span>
          <button
            type="button"
            className="kids-chip"
            onClick={() => onChange("")}
          >
            {t("memberLink.removeLink")}
          </button>
        </div>
      ) : (
        <>
          <input
            className="children-input"
            aria-label={t("memberLink.searchLabel")}
            placeholder={t("memberLink.placeholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setRows([]);
              setLoading(e.target.value.trim().length >= 2);
            }}
          />
          {query.length >= 2 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-[#dde4d5] bg-white">
              {rows.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  className="kids-row w-full px-3 text-left text-sm hover:bg-[#fafaf4]"
                  onClick={() => {
                    onChange(p._id, p);
                    setSearch("");
                    setRows([]);
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className="kids-avatar blue">
                      {initials(`${p.firstName} ${p.lastName}`)}
                    </span>
                    <span>
                      <strong>
                        {p.firstName} {p.lastName}
                      </strong>
                      {(p.phone || p.email) && (
                        <span className="children-muted block">
                          {[p.phone, p.email].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              {!rows.length && (
                <p className="children-muted p-3">
                  {loading
                    ? t("memberLink.searching")
                    : t("memberLink.noResults", { query })}
                </p>
              )}
            </div>
          )}
        </>
      )}
      <p className="children-muted mt-2 text-xs">{t("memberLink.hint")}</p>
    </div>
  );
}

/* ---------- FamilyForm ---------------------------------------------------- */

type GuardianDraft = Omit<Guardian, "id"> & { id?: string };
const blankGuardian = (relationship: string): GuardianDraft => ({
  firstName: "",
  lastName: "",
  phone: "",
  relationship,
  canCheckIn: true,
});

export function FamilyForm({
  options,
  family,
  initialBranchId,
}: {
  options: ChildrenOptions;
  family?: Family;
  initialBranchId?: string;
}) {
  const t = useTranslations("childrenRecords");
  const router = useRouter();
  const defaultRelationship = t("relationships.parent");
  const [branch, setBranch] = useState(
      family?.branchId || initialBranchId || options.branches[0]?._id || "",
    ),
    [name, setName] = useState(family?.name || ""),
    [guardians, setGuardians] = useState<GuardianDraft[]>(
      family?.guardians || [blankGuardian(defaultRelationship)],
    );
  const registrationKey = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  function patch(i: number, p: Partial<Guardian>) {
    setGuardians((rows) => rows.map((g, n) => (i === n ? { ...g, ...p } : g)));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!registrationKey.current) registrationKey.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const body = {
      branchId: branch,
      name: f.get("name"),
      guardians: guardians.map((g) => ({
        ...g,
        ...(!g.email ? { email: undefined } : {}),
        ...(!g.memberId ? { memberId: undefined } : {}),
      })),
      registrationKey: registrationKey.current,
      ...(family ? { expectedRevision: family.revision } : {}),
    };
    try {
      const r = family
        ? await apiPatch<{ _id: string }>(
            `/children/families/${family._id}`,
            body,
          )
        : await apiPost<{ _id: string }>("/children/families", body);
      router.push(`/children/families/${r._id}?saved=1`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("family.saveError"));
      setError(e instanceof Error ? e.message : t("family.saveError"));
      setBusy(false);
    }
  }
  const checkInCount = guardians.filter((g) => g.canCheckIn).length;
  return (
    <form className="space-y-5 kids-fade-in" onSubmit={submit}>
      <section className="children-panel space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="kids-avatar green !h-14 !w-14 !text-xl">
              {initials(name || "?")}
            </span>
            <div>
              <p className="children-kicker">
                {family ? t("family.kickerEdit") : t("family.kickerNew")}
              </p>
              <h1 className="mt-1 text-3xl font-bold">
                {family ? t("family.titleEdit") : t("family.titleNew")}
              </h1>
            </div>
          </div>
        </div>
        <p className="children-muted max-w-2xl">{t("family.intro")}</p>
        <StepHeading n={1} title={t("family.stepFamily")} />
        <div className="children-grid">
          <Field
            label={t("common.church")}
            hint={family ? t("family.churchLocked") : undefined}
          >
            <select
              className="children-input"
              value={branch}
              disabled={!!family}
              onChange={(e) => {
                setBranch(e.target.value);
                setGuardians([blankGuardian(defaultRelationship)]);
              }}
              required
            >
              {options.branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("family.familyName")}
            hint={t("family.familyNameHint")}
          >
            <input
              className="children-input"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("family.familyNamePlaceholder")}
              minLength={2}
              maxLength={120}
              required
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="children-panel">
          <StepHeading
            n={2}
            tone="green"
            title={t("family.stepAdults")}
            description={t("family.adultsIntro")}
          />
        </div>
        {guardians.map((g, i) => (
          <section
            key={g.id || i}
            className="children-panel space-y-4 kids-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="kids-avatar">
                  {initials(
                    `${g.firstName} ${g.lastName}`.trim() || String(i + 1),
                  )}
                </span>
                <div>
                  <h3 className="text-lg font-bold">
                    {t("family.adult", { n: i + 1 })}
                  </h3>
                  {i === 0 && (
                    <span className="children-badge amber">
                      {t("family.primary")}
                    </span>
                  )}
                </div>
              </div>
              {guardians.length > 1 && (
                <button
                  type="button"
                  className="children-button danger !min-h-9 !px-3 !text-sm"
                  aria-label={t("family.removeAdult", { n: i + 1 })}
                  onClick={() =>
                    setGuardians((rows) => rows.filter((_, n) => n !== i))
                  }
                >
                  {t("common.remove")}
                </button>
              )}
            </div>
            <AdultMemberLink
              branchId={branch}
              value={g.memberId}
              onChange={(id, p) =>
                patch(i, {
                  memberId: id,
                  ...(p
                    ? {
                        firstName: p.firstName,
                        lastName: p.lastName,
                        phone: p.phone || g.phone,
                        email: p.email || g.email,
                      }
                    : {}),
                })
              }
            />
            <div className="children-grid">
              <Field label={t("common.firstName")}>
                <input
                  className="children-input"
                  value={g.firstName}
                  onChange={(e) => patch(i, { firstName: e.target.value })}
                  maxLength={80}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label={t("common.lastName")}>
                <input
                  className="children-input"
                  value={g.lastName}
                  onChange={(e) => patch(i, { lastName: e.target.value })}
                  maxLength={80}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label={t("family.phoneLabel")}>
                <input
                  type="tel"
                  inputMode="tel"
                  className="children-input"
                  value={g.phone}
                  onChange={(e) => patch(i, { phone: e.target.value })}
                  minLength={5}
                  maxLength={40}
                  required
                />
              </Field>
              <Field label={t("common.email")}>
                <input
                  type="email"
                  className="children-input"
                  value={g.email || ""}
                  onChange={(e) => patch(i, { email: e.target.value })}
                />
              </Field>
            </div>
            <div className="space-y-2">
              <span className="children-label">{t("common.relationship")}</span>
              <RelationshipChips
                t={t}
                value={g.relationship}
                onPick={(label) => patch(i, { relationship: label })}
              />
              <input
                className="children-input"
                value={g.relationship}
                onChange={(e) => patch(i, { relationship: e.target.value })}
                placeholder={t("family.relationshipPlaceholder")}
                minLength={2}
                maxLength={60}
                required
              />
              <p className="children-muted text-xs">
                {t("family.relationshipHint")}
              </p>
            </div>
            <Switch
              checked={g.canCheckIn}
              onChange={(v) => patch(i, { canCheckIn: v })}
              label={t("family.canCheckIn")}
              hint={t("family.canCheckInHint")}
              onText={t("common.on")}
              offText={t("common.off")}
            />
            <p className="children-muted text-xs">{t("family.pickupHint")}</p>
          </section>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="children-button secondary"
            type="button"
            disabled={guardians.length >= 12}
            onClick={() =>
              setGuardians([...guardians, blankGuardian(defaultRelationship)])
            }
          >
            {t("family.addAdult")}
          </button>
          <span className="children-muted text-xs">
            {t("family.maxAdults")}
          </span>
        </div>
      </section>

      <section className="children-panel space-y-4">
        <StepHeading n={3} tone="blue" title={t("family.stepSave")} />
        <div className="flex flex-wrap gap-2">
          <span className="children-badge">
            {t("family.summaryAdults", { count: guardians.length })}
          </span>
          <span className={`children-badge ${checkInCount ? "" : "rose"}`}>
            {t("family.summaryCheckIn", { count: checkInCount })}
          </span>
        </div>
        <p className="children-muted">
          {family ? t("family.summaryNextEdit") : t("family.summaryNext")}
        </p>
        {error && (
          <p role="alert" className="children-error">
            {error}
          </p>
        )}
        <button
          className="children-button lg"
          type="submit"
          disabled={busy || !branch}
        >
          {busy ? t("common.saving") : t("family.save")}
        </button>
      </section>
    </form>
  );
}

/* ---------- ChildForm ----------------------------------------------------- */

export function ChildForm({
  family,
  child,
}: {
  family: Family;
  child?: ChildProfile;
}) {
  const t = useTranslations("childrenRecords");
  const ageLabel = useAgeLabel();
  const router = useRouter();
  const registrationKey = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [firstName, setFirstName] = useState(child?.firstName || ""),
    [lastName, setLastName] = useState(child?.lastName || ""),
    [birthDate, setBirthDate] = useState(child?.birthDate || ""),
    [isMember, setIsMember] = useState(child?.isMember ?? true),
    [isActive, setIsActive] = useState(child?.isActive ?? true),
    [photoConsent, setPhotoConsent] = useState(child?.photoConsent ?? false);
  const [links, setLinks] = useState(
      child?.guardianIds || family.guardians.map((g) => g.id),
    ),
    [pickup, setPickup] = useState(child?.pickupGuardianIds || []);
  const months = useMemo(() => ageInMonths(birthDate), [birthDate]);

  function toggle(id: string, checked: boolean) {
    setLinks((x) => (checked ? [...x, id] : x.filter((v) => v !== id)));
    if (!checked) setPickup((x) => x.filter((v) => v !== id));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!registrationKey.current) registrationKey.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const body = {
      familyId: family._id,
      registrationKey: registrationKey.current,
      firstName: f.get("firstName"),
      lastName: f.get("lastName"),
      birthDate: f.get("birthDate"),
      guardianIds: links,
      pickupGuardianIds: pickup,
      careNotes: f.get("careNotes"),
      pickupNotes: f.get("pickupNotes"),
      isMember,
      isActive,
      photoConsent,
      ...(f.get("photoUrl") ? { photoUrl: f.get("photoUrl") } : {}),
      ...(child ? { expectedRevision: child.revision } : {}),
    };
    try {
      if (child) await apiPatch(`/children/profiles/${child._id}`, body);
      else await apiPost("/children/profiles", body);
      router.push(`/children/families/${family._id}?saved=1`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("child.saveError"));
      setError(e instanceof Error ? e.message : t("child.saveError"));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5 kids-fade-in">
      <section className="children-panel space-y-5">
        <div className="flex items-center gap-4">
          <span className="kids-avatar plum !h-14 !w-14 !text-xl">
            {initials(`${firstName} ${lastName}`.trim() || family.name)}
          </span>
          <div>
            <p className="children-kicker">{family.name}</p>
            <h1 className="mt-1 text-3xl font-bold">
              {child ? t("child.titleEdit") : t("child.titleNew")}
            </h1>
          </div>
        </div>
        <StepHeading n={1} title={t("child.stepIdentity")} />
        <div className="children-grid">
          <Field label={t("common.firstName")}>
            <input
              className="children-input"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={80}
              autoComplete="off"
              required
            />
          </Field>
          <Field label={t("common.lastName")}>
            <input
              className="children-input"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={80}
              autoComplete="off"
              required
            />
          </Field>
          <Field label={t("child.birthDate")} hint={t("child.ageHint")}>
            <input
              className="children-input"
              type="date"
              name="birthDate"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={localDateValue(new Date())}
              required
            />
          </Field>
          <div className="kids-stat amber self-start">
            <span className="kids-stat-label">{t("child.ageNow")}</span>
            <span className="kids-stat-value !text-2xl" aria-live="polite">
              {ageLabel(months)}
            </span>
          </div>
        </div>
        <div className="children-grid">
          <Switch
            checked={isMember}
            onChange={setIsMember}
            label={t("child.isMember")}
            hint={t("child.isMemberHint")}
            onText={t("common.on")}
            offText={t("common.off")}
          />
          <Switch
            checked={isActive}
            onChange={setIsActive}
            label={t("child.isActive")}
            hint={t("child.isActiveHint")}
            onText={t("common.on")}
            offText={t("common.off")}
          />
        </div>
      </section>

      <section className="children-panel space-y-4">
        <StepHeading
          n={2}
          tone="green"
          title={t("child.stepGuardians")}
          description={t("child.guardiansIntro")}
        />
        <div className="space-y-3">
          {family.guardians.map((g) => {
            const linked = links.includes(g.id),
              collects = pickup.includes(g.id);
            return (
              <div
                key={g.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 transition-colors ${
                  linked
                    ? "bg-[#f7f7f0]"
                    : "bg-white border border-dashed border-[#dde4d5]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`kids-avatar ${linked ? "green" : ""}`}>
                    {initials(`${g.firstName} ${g.lastName}`)}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {g.firstName} {g.lastName}
                    </p>
                    <p className="children-muted">
                      {g.relationship} ·{" "}
                      {g.canCheckIn
                        ? t("child.mayCheckIn")
                        : t("child.contactOnly")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="kids-chip"
                    aria-pressed={linked}
                    onClick={() => toggle(g.id, !linked)}
                  >
                    {linked ? "✓ " : ""}
                    {linked ? t("child.linked") : t("child.notLinked")}
                  </button>
                  <button
                    type="button"
                    className="kids-chip"
                    aria-pressed={collects}
                    disabled={!linked}
                    title={!linked ? t("child.linkFirst") : undefined}
                    onClick={() =>
                      setPickup((ids) =>
                        collects
                          ? ids.filter((id) => id !== g.id)
                          : [...ids, g.id],
                      )
                    }
                  >
                    {collects ? "🔑 " : ""}
                    {collects
                      ? t("child.mayCollect")
                      : t("child.mayNotCollect")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p
          className={`children-badge ${pickup.length ? "" : "rose"}`}
          aria-live="polite"
        >
          {t("child.pickupCount", { count: pickup.length })}
        </p>
        {!pickup.length && (
          <p className="kids-banner amber">{t("child.noPickupWarning")}</p>
        )}
      </section>

      <section className="children-panel space-y-4">
        <StepHeading n={3} tone="blue" title={t("child.stepCare")} />
        <p className="children-notice">🔒 {t("child.privacy")}</p>
        <Field label={t("child.careNotes")}>
          <textarea
            className="children-input min-h-28"
            name="careNotes"
            defaultValue={child?.careNotes}
            placeholder={t("child.careNotesPlaceholder")}
            maxLength={3000}
          />
        </Field>
        <Field label={t("child.pickupNotes")}>
          <textarea
            className="children-input min-h-24"
            name="pickupNotes"
            defaultValue={child?.pickupNotes}
            placeholder={t("child.pickupNotesPlaceholder")}
            maxLength={3000}
          />
        </Field>
        <details
          className="rounded-xl bg-[#f7f7f0] p-4"
          open={!!child?.photoUrl}
        >
          <summary className="cursor-pointer font-semibold">
            {t("child.photoTitle")}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="children-muted">{t("child.photoExplain")}</p>
            <Switch
              checked={photoConsent}
              onChange={setPhotoConsent}
              label={t("child.photoConsent")}
              onText={t("common.on")}
              offText={t("common.off")}
            />
            <Field label={t("child.photoUrl")}>
              <input
                className="children-input"
                type="url"
                name="photoUrl"
                defaultValue={child?.photoUrl}
                placeholder="https://…"
              />
            </Field>
          </div>
        </details>
      </section>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      <button className="children-button lg" type="submit" disabled={busy}>
        {busy ? t("common.saving") : t("child.save")}
      </button>
    </form>
  );
}

/* ---------- ChildSessionForm ---------------------------------------------- */

type RoomDraft = {
  key: string;
  name: string;
  minMonths: number;
  maxMonths: number;
  capacity: number;
};
let roomSeq = 0;
const roomKey = () => `r${++roomSeq}`;
const noopSubscribe = () => () => {};

function nextWeekday(weekday: number, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function quickPick(
  kind: "now" | "sunday" | "sundayLate" | "midweek" | "saturday",
) {
  const now = new Date();
  if (kind === "now") {
    const start = new Date(now);
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
    const end = new Date(start.getTime() + 3 * 3600_000);
    const lastMinute = new Date(start);
    lastMinute.setHours(23, 59, 0, 0);
    if (end > lastMinute) end.setTime(lastMinute.getTime());
    return {
      date: localDateValue(start),
      start: localTimeValue(start),
      end: localTimeValue(end),
    };
  }
  const spec = {
    sunday: { day: 0, start: "09:00", end: "12:30" },
    sundayLate: { day: 0, start: "11:00", end: "13:30" },
    midweek: { day: 3, start: "18:00", end: "20:00" },
    saturday: { day: 6, start: "10:00", end: "13:00" },
  }[kind];
  let day = nextWeekday(spec.day, now);
  const endsAt = new Date(`${localDateValue(day)}T${spec.end}:00`);
  if (endsAt <= now)
    day = nextWeekday(spec.day, new Date(day.getTime() + 86_400_000));
  return { date: localDateValue(day), start: spec.start, end: spec.end };
}

function YearsMonths({
  label,
  value,
  onChange,
  t,
  invalid,
}: {
  label: string;
  value: number;
  onChange: (months: number) => void;
  t: T;
  invalid?: boolean;
}) {
  const { years, months } = splitMonths(value);
  const cls = `children-input !min-h-11 ${invalid ? "!border-[#d97a6a]" : ""}`;
  return (
    <fieldset className="min-w-0">
      <legend className="children-label">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="sr-only">{t("session.years")}</span>
          <input
            className={cls}
            type="number"
            min={0}
            max={18}
            value={years}
            aria-label={`${label} – ${t("session.years")}`}
            onChange={(e) =>
              onChange(
                Math.min(
                  MAX_MONTHS,
                  Math.max(0, Number(e.target.value) * 12 + months),
                ),
              )
            }
            required
          />
          <span className="children-muted block text-center text-xs">
            {t("session.years")}
          </span>
        </label>
        <label className="block">
          <span className="sr-only">{t("session.months")}</span>
          <input
            className={cls}
            type="number"
            min={0}
            max={11}
            value={months}
            aria-label={`${label} – ${t("session.months")}`}
            onChange={(e) =>
              onChange(
                Math.min(
                  MAX_MONTHS,
                  Math.max(
                    0,
                    years * 12 +
                      Math.min(11, Math.max(0, Number(e.target.value))),
                  ),
                ),
              )
            }
            required
          />
          <span className="children-muted block text-center text-xs">
            {t("session.months")}
          </span>
        </label>
      </div>
    </fieldset>
  );
}

const COVERAGE_COLORS = [
  "#245b4b",
  "#e3a84f",
  "#6f9ccb",
  "#8c6fb8",
  "#d97a6a",
  "#88b8a9",
];

export function ChildSessionForm({
  options,
  initialBranchId,
}: {
  options: ChildrenOptions;
  initialBranchId?: string;
}) {
  const actionToast = useActionToast();

  const t = useTranslations("childrenRecords");
  const format = useFormatter();
  const router = useRouter();
  const registrationKey = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reusing, setReusing] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const [branchId, setBranchId] = useState(
    initialBranchId || options.branches[0]?._id || "",
  );
  const [name, setName] = useState("");
  // The default time window comes from the browser clock, so it only applies once
  // mounted: server and client render the same (empty) markup first.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [edited, setEdited] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const defaultWhen = useMemo(
    () => (mounted ? quickPick("sunday") : { date: "", start: "", end: "" }),
    [mounted],
  );
  const when = edited ?? defaultWhen;
  const setWhen = setEdited;
  const [timeTouched, setTimeTouched] = useState({ start: false, end: false });
  const [rooms, setRooms] = useState<RoomDraft[]>(() =>
    (["nursery", "preschool", "kids"] as const).map((k) => {
      const tpl = ROOM_TEMPLATES.find((r) => r.key === k)!;
      return {
        key: `init-${k}`,
        name: shortTemplateName(t(`session.template.${k}`)),
        minMonths: tpl.minMonths,
        maxMonths: tpl.maxMonths,
        capacity: tpl.capacity,
      };
    }),
  );

  const startValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(when.start);
  const endValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(when.end);
  const startsAt = useMemo(
    () =>
      when.date && startValid
        ? new Date(`${when.date}T${when.start}:00`)
        : null,
    [when.date, when.start, startValid],
  );
  const endsAt = useMemo(
    () =>
      when.date && endValid ? new Date(`${when.date}T${when.end}:00`) : null,
    [when.date, when.end, endValid],
  );
  const durationMin =
    startsAt && endsAt
      ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
      : 0;
  const startError = startValid ? "" : t("session.invalidTime");
  const endError =
    !endValid ? t("session.invalidTime") : startsAt && endsAt
      ? when.end <= when.start || durationMin <= 0
        ? t("session.endBeforeStart")
        : endsAt <= new Date()
          ? t("session.endInPast")
          : ""
      : "";
  const timeError = startError || endError;
  const shownStartError = submitted || timeTouched.start ? startError : "";
  const shownEndError = submitted || timeTouched.end || endValid ? endError : "";

  /* per-room validation */
  type RoomError =
    | "nameRequired"
    | "duplicateName"
    | "maxBelowMin"
    | "capacity";
  const roomErrors = rooms.map((r) => {
    const errs: RoomError[] = [];
    if (!r.name.trim()) errs.push("nameRequired");
    else if (
      rooms.some(
        (o) =>
          o !== r &&
          o.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
      )
    )
      errs.push("duplicateName");
    if (r.maxMonths < r.minMonths) errs.push("maxBelowMin");
    if (!(r.capacity >= 1 && r.capacity <= 500)) errs.push("capacity");
    return errs;
  });
  const roomsValid = roomErrors.every((e) => !e.length);
  const hints = useMemo(() => {
    const out: string[] = [];
    const sorted = [...rooms]
      .filter((r) => r.maxMonths >= r.minMonths)
      .sort((a, b) => a.minMonths - b.minMonths);
    const age = (m: number) => ageShort(m, t);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!,
        cur = sorted[i]!;
      if (cur.minMonths > prev.maxMonths + 1)
        out.push(
          t("session.hints.gap", {
            from: age(prev.maxMonths + 1),
            to: age(cur.minMonths - 1),
          }),
        );
      else if (cur.minMonths <= prev.maxMonths && prev.name && cur.name)
        out.push(t("session.hints.overlap", { a: prev.name, b: cur.name }));
    }
    if (sorted.length)
      out.push(
        t("session.hints.covered", {
          from: age(sorted[0]!.minMonths),
          to: age(Math.max(...sorted.map((r) => r.maxMonths))),
        }),
      );
    return out;
  }, [rooms, t]);

  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const canSubmit =
    !busy &&
    !!branchId &&
    name.trim().length >= 2 &&
    !timeError &&
    !!startsAt &&
    roomsValid &&
    rooms.length > 0;

  function patchRoom(key: string, p: Partial<RoomDraft>) {
    setRooms((rows) => rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }
  function addTemplate(k: (typeof ROOM_TEMPLATES)[number]["key"]) {
    const tpl = ROOM_TEMPLATES.find((r) => r.key === k)!;
    const label = shortTemplateName(t(`session.template.${k}`));
    setRooms((rows) =>
      rows.length >= 20
        ? rows
        : [
            ...rows,
            {
              key: roomKey(),
              name: rows.some(
                (r) => r.name.toLowerCase() === label.toLowerCase(),
              )
                ? `${label} ${rows.length + 1}`
                : label,
              minMonths: tpl.minMonths,
              maxMonths: tpl.maxMonths,
              capacity: tpl.capacity,
            },
          ],
    );
  }
  async function reuse() {
    setReusing(true);

    setError("");
    try {
      const last = await apiGet<LatestRooms>(
        `/children/sessions/latest-rooms?branchId=${encodeURIComponent(branchId)}`,
      );
      if (!last) {
        toast.info(t("session.reuseNone"));
        return;
      }
      setRooms(last.rooms.slice(0, 20).map((r) => ({ key: roomKey(), ...r })));
      if (!name.trim()) setName(last.name);
      const s = new Date(last.startsAt),
        e = new Date(last.endsAt);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
        // Same clock times, next occurrence of the same weekday.
        let day = nextWeekday(s.getDay());
        if (
          new Date(`${localDateValue(day)}T${localTimeValue(e)}:00`) <=
          new Date()
        )
          day = nextWeekday(s.getDay(), new Date(day.getTime() + 86_400_000));
        setWhen({
          date: localDateValue(day),
          start: localTimeValue(s),
          end: localTimeValue(e),
        });
      }
      toast.success(t("session.reuseDone", { name: last.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("session.reuseError"));
    } finally {
      setReusing(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit || !startsAt || !endsAt) return;
    if (!registrationKey.current) registrationKey.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const r = await apiPost<{ _id: string }>("/children/sessions", {
        registrationKey: registrationKey.current,
        branchId,
        name: name.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        rooms: rooms.map(({ name, minMonths, maxMonths, capacity }) => ({
          name: name.trim(),
          minMonths,
          maxMonths,
          capacity,
        })),
      });
      router.push(`/children/sessions/${r._id}`);
      router.refresh();

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("session.openError"));
      setError(e instanceof Error ? e.message : t("session.openError"));
      setBusy(false);
    }
  }

  const durationText =
    durationMin > 0
      ? durationMin % 60 === 0
        ? t("session.durationH", { hours: durationMin / 60 })
        : durationMin < 60
          ? t("session.durationM", { minutes: durationMin })
          : t("session.durationHM", {
              hours: Math.floor(durationMin / 60),
              minutes: durationMin % 60,
            })
      : "—";
  const suggestionKeys = [
    "sundayFirst",
    "sundaySecond",
    "midweek",
    "special",
    "holiday",
  ] as const;
  const quickKeys = [
    "now",
    "sunday",
    "sundayLate",
    "midweek",
    "saturday",
  ] as const;

  return (
    <form onSubmit={submit} className="kids-split kids-fade-in" noValidate>
      <div className="space-y-5">
        <section className="children-panel space-y-5">
          <div>
            <p className="children-kicker">{t("session.kicker")}</p>
            <h1 className="mt-2 text-3xl font-bold">{t("session.title")}</h1>
            <p className="children-muted mt-2 max-w-2xl">
              {t("session.intro")}
            </p>
          </div>
          <StepHeading n={1} title={t("session.stepBasics")} />
          {options.branches.length > 1 && (
            <Field label={t("common.church")}>
              <select
                className="children-input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              >
                {options.branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="space-y-2">
            <Field label={t("session.name")}>
              <input
                className="children-input lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("session.namePlaceholder")}
                minLength={2}
                maxLength={120}
                aria-invalid={submitted && name.trim().length < 2}
                required
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {suggestionKeys.map((k) => {
                const label = t(`session.suggestions.${k}`);
                return (
                  <button
                    key={k}
                    type="button"
                    className="kids-chip"
                    aria-pressed={name === label}
                    onClick={() => setName(label)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="kids-chip"
                  onClick={() => setWhen(quickPick(k))}
                >
                  {k === "now" ? "⚡ " : "📅 "}
                  {t(`session.quick.${k}`)}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("session.date")}>
                <input
                  type="date"
                  className="children-input"
                  value={when.date}
                  min={localDateValue(new Date())}
                  onChange={(e) => setWhen({ ...when, date: e.target.value })}
                  required
                />
              </Field>
              <Field label={t("session.starts")} hint={t("session.timeHint", { example: format.dateTime(new Date(2000, 0, 1, 9, 30), { hour: "numeric", minute: "2-digit" }) })} error={shownStartError} descriptionId="session-start-description">
                <input
                  type="time"
                  className={`children-input ${shownStartError ? "!border-[#d97a6a]" : ""}`}
                  value={when.start}
                  onChange={(e) => setWhen({ ...when, start: e.target.value })}
                  onBlur={() => setTimeTouched((previous) => ({ ...previous, start: true }))}
                  aria-invalid={!!shownStartError}
                  aria-describedby="session-start-description"
                  required
                />
              </Field>
              <Field label={t("session.ends")} hint={t("session.timeHint", { example: format.dateTime(new Date(2000, 0, 1, 12, 30), { hour: "numeric", minute: "2-digit" }) })} error={shownEndError} descriptionId="session-end-description">
                <input
                  type="time"
                  className={`children-input ${shownEndError ? "!border-[#d97a6a]" : ""}`}
                  value={when.end}
                  onChange={(e) => setWhen({ ...when, end: e.target.value })}
                  onBlur={() => setTimeTouched((previous) => ({ ...previous, end: true }))}
                  aria-invalid={!!shownEndError}
                  aria-describedby="session-end-description"
                  required
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="children-badge blue">
                ⏱ {t("session.durationLabel")}: {durationText}
              </span>
              {startsAt && !timeError && (
                <span className="children-muted">
                  {format.dateTime(startsAt, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="children-panel space-y-5">
          <StepHeading
            n={2}
            tone="green"
            title={t("session.stepRooms")}
            description={t("session.roomsIntro")}
            action={
              <button
                type="button"
                className="children-button secondary"
                disabled={reusing || !branchId}
                onClick={() => void reuse()}
              >
                {reusing ? t("session.reuseLoading") : t("session.reuse")}
              </button>
            }
          />

          <div className="space-y-2">
            <span className="children-label">{t("session.templates")}</span>
            <div className="flex flex-wrap gap-2">
              {ROOM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  className="kids-chip"
                  disabled={rooms.length >= 20}
                  onClick={() => addTemplate(tpl.key)}
                >
                  + {t(`session.template.${tpl.key}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {rooms.map((r, i) => {
              const errs = roomErrors[i]!;
              const show = submitted || r.name.length > 0;
              return (
                <div
                  key={r.key}
                  className="children-room rounded-2xl bg-[#fbfbf6] p-4 kids-fade-in"
                  style={{
                    borderTopColor: COVERAGE_COLORS[i % COVERAGE_COLORS.length],
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="kids-avatar !h-8 !w-8 !text-sm">
                        {i + 1}
                      </span>
                      {t("session.room", { n: i + 1 })}
                      <span className="children-badge neutral">
                        {ageShort(r.minMonths, t)} – {ageShort(r.maxMonths, t)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="kids-chip"
                      disabled={rooms.length === 1}
                      onClick={() =>
                        setRooms((rows) => rows.filter((x) => x.key !== r.key))
                      }
                    >
                      ✕ {t("session.removeRoom")}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1.6fr_1.2fr_1.2fr_0.8fr]">
                    <Field label={t("session.roomName")}>
                      <input
                        className={`children-input ${show && errs.some((e) => e === "nameRequired" || e === "duplicateName") ? "!border-[#d97a6a]" : ""}`}
                        value={r.name}
                        placeholder={t("session.roomNamePlaceholder")}
                        maxLength={60}
                        onChange={(e) =>
                          patchRoom(r.key, { name: e.target.value })
                        }
                        required
                      />
                    </Field>
                    <YearsMonths
                      t={t}
                      label={t("session.minAge")}
                      value={r.minMonths}
                      onChange={(m) => patchRoom(r.key, { minMonths: m })}
                    />
                    <YearsMonths
                      t={t}
                      label={t("session.maxAge")}
                      value={r.maxMonths}
                      invalid={r.maxMonths < r.minMonths}
                      onChange={(m) => patchRoom(r.key, { maxMonths: m })}
                    />
                    <Field label={t("session.capacity")}>
                      <input
                        className={`children-input ${!(r.capacity >= 1 && r.capacity <= 500) ? "!border-[#d97a6a]" : ""}`}
                        type="number"
                        min={1}
                        max={500}
                        value={r.capacity}
                        onChange={(e) =>
                          patchRoom(r.key, { capacity: Number(e.target.value) })
                        }
                        required
                      />
                    </Field>
                  </div>
                  {show && errs.length > 0 && (
                    <ul
                      className="mt-2 space-y-1 text-sm text-[#953c2e]"
                      role="alert"
                    >
                      {errs.map((e) => (
                        <li key={e}>• {t(`session.errors.${e}`)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="children-button secondary"
              disabled={rooms.length >= 20}
              onClick={() =>
                setRooms([
                  ...rooms,
                  {
                    key: roomKey(),
                    name: "",
                    minMonths: 0,
                    maxMonths: 215,
                    capacity: 20,
                  },
                ])
              }
            >
              {t("session.addRoom")}
            </button>
            <span className="children-muted text-xs">
              {t("session.maxRooms")}
            </span>
          </div>
        </section>
      </div>

      <aside>
        <div className="kids-sticky space-y-4">
          <section className="children-panel space-y-4">
            <p className="children-kicker">{t("session.summary")}</p>
            <h2 className="text-2xl font-bold leading-tight">
              {name.trim() || t("session.namePlaceholder")}
            </h2>
            <div>
              <p className="children-label">{t("session.when")}</p>
              <p className={timeError ? "text-[#953c2e]" : ""}>
                {startsAt && endsAt && !Number.isNaN(startsAt.getTime())
                  ? `${format.dateTime(startsAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} → ${format.dateTime(endsAt, { hour: "numeric", minute: "2-digit" })}`
                  : t("session.notScheduled")}
              </p>
            </div>
            <div className="kids-stats !grid-cols-2">
              <div className="kids-stat green">
                <span className="kids-stat-value">{rooms.length}</span>
                <span className="kids-stat-label">
                  {t("session.rooms", { count: rooms.length })}
                </span>
              </div>
              <div className="kids-stat amber">
                <span className="kids-stat-value">{totalCapacity}</span>
                <span className="kids-stat-label">
                  {t("session.totalCapacity")}
                </span>
                <span className="kids-stat-hint">
                  {t("session.places", { count: totalCapacity })}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="children-label !mb-1">{t("session.coverage")}</p>
                <span className="children-muted text-xs">
                  {t("session.coverageHint")}
                </span>
              </div>
              <div
                className="relative h-5 overflow-hidden rounded-full bg-[#ecefe6]"
                role="img"
                aria-label={hints.join(" ")}
              >
                {rooms.map((r, i) =>
                  r.maxMonths >= r.minMonths ? (
                    <span
                      key={r.key}
                      title={`${r.name}: ${ageShort(r.minMonths, t)} – ${ageShort(r.maxMonths, t)}`}
                      className="absolute top-0 h-full opacity-80"
                      style={{
                        left: `${(r.minMonths / MAX_MONTHS) * 100}%`,
                        width: `${((r.maxMonths - r.minMonths + 1) / MAX_MONTHS) * 100}%`,
                        background: COVERAGE_COLORS[i % COVERAGE_COLORS.length],
                      }}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[#8a9589]">
                {[0, 3, 6, 9, 12, 15, 18].map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
              {hints.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-[#65746a]">
                  {hints.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              )}
            </div>
            {error && (
              <p role="alert" className="children-error">
                {error}
              </p>
            )}
            {submitted && !canSubmit && !busy && (
              <p className="children-muted text-[#953c2e]">
                {t("session.fixFirst")}
              </p>
            )}
            <button
              type="submit"
              className="children-button lg w-full"
              disabled={busy || (submitted && !canSubmit)}
            >
              {busy ? t("session.opening") : `🚪 ${t("session.open")}`}
            </button>
            <p className="children-muted text-xs">{t("session.oneOpen")}</p>
          </section>
        </div>
      </aside>
    </form>
  );
}

/** "Nursery 0–2" → "Nursery" (strips the age hint from a translated template label). */
function shortTemplateName(label: string) {
  return label.replace(/\s*\d+\s*[–-]\s*\d+\s*$/, "").trim() || label;
}
function ageShort(months: number, t: T) {
  const { years, months: m } = splitMonths(months);
  if (years === 0) return t("age.monthsShort", { months: m });
  if (m === 0) return t("age.yearsShort", { years });
  return t("age.yearsMonthsShort", { years, months: m });
}
