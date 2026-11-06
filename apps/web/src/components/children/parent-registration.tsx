"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { ChildrenWelcome } from "./welcome";
import { RELATIONSHIP_KEYS, ageInMonths, initials, localDateValue, splitMonths } from "./records-utils";

const newAdult = (relationship: string) => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  relationship,
});
const newChild = () => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  pickupAdults: [0],
  careNotes: "",
});
const STEPS = [1, 2, 3] as const;

export function ParentRegistrationForm({ token }: { token: string }) {
  const t = useTranslations("childrenRecords");
  const defaultRelationship = t("parent.relationshipDefault");
  const [church, setChurch] = useState(""),
    [familyName, setFamilyName] = useState(""),
    [adults, setAdults] = useState([newAdult(defaultRelationship)]),
    [children, setChildren] = useState([newChild()]),
    [step, setStep] = useState<1 | 2 | 3>(1),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [received, setReceived] = useState(false),
    [error, setError] = useState("");
  const requestKey = useRef(""),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    void fetch(`${API_URL}/children-registration`, {
      headers: { "x-children-registration": token },
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(t("parent.unavailable"));
        return (await r.json()) as { churchName: string };
      })
      .then((r) => {
        if (active) setChurch(r.churchName);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : t("parent.unavailable"));
      });
    return () => {
      active = false;
    };
  }, [token, t]);
  function removeAdult(index: number) {
    setAdults((rows) => rows.filter((_, i) => i !== index));
    setChildren((rows) =>
      rows.map((c) => {
        const ids = c.pickupAdults
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));
        return { ...c, pickupAdults: ids.length ? ids : [0] };
      }),
    );
  }
  function goTo(next: 1 | 2 | 3) {
    setStep(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) {
      goTo(2);
      return;
    }
    if (step === 2) {
      if (children.some((c) => !c.pickupAdults.length)) {
        setError(t("parent.pickupRequired"));
        return;
      }
      goTo(3);
      return;
    }
    setBusy(true);
    setError("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const response = await fetch(`${API_URL}/children-registration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-children-registration": token,
        },
        credentials: "omit",
        cache: "no-store",
        body: JSON.stringify({
          requestKey: requestKey.current,
          familyName,
          adults: adults.map((a) => ({ ...a, email: a.email || undefined })),
          children,
          consent,
          website: new FormData(e.currentTarget).get("website") || "",
        }),
      });
      const result = (await response.json()) as { message?: string | string[] };
      if (!response.ok)
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join(", ")
            : result.message || t("parent.submitError"),
        );
      setReceived(true);
      setAdults([newAdult(defaultRelationship)]);
      setChildren([newChild()]);
      setFamilyName("");
      setConsent(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("parent.submitError"));
    } finally {
      setBusy(false);
    }
  }
  const age = (birthDate: string) => {
    const m = ageInMonths(birthDate);
    if (m === null) return "";
    if (m === 0) return t("age.newborn");
    const { years, months } = splitMonths(m);
    if (years === 0) return t("age.months", { months });
    if (months === 0) return t("age.years", { years });
    return t("age.yearsMonths", { years, months });
  };
  const stepTitle = { 1: t("parent.step1"), 2: t("parent.step2"), 3: t("parent.step3") };
  const input = "children-input min-h-[52px] text-base";
  return (
    <div className="space-y-6">
      <ChildrenWelcome
        title={church ? t("parent.welcomeChurch", { church }) : t("parent.welcome")}
        description={t("parent.welcomeDescription")}
      />
      {received ? (
        <section className="children-panel kids-fade-in text-center">
          <p className="text-6xl" aria-hidden="true">
            ☀
          </p>
          <h2 className="mt-4 text-3xl font-bold">{t("parent.receivedTitle")}</h2>
          <p className="children-muted mx-auto mt-4 max-w-xl">{t("parent.receivedBody")}</p>
          <button
            type="button"
            className="children-button secondary mt-6"
            onClick={() => {
              setReceived(false);
              setStep(1);
              requestKey.current = "";
            }}
          >
            {t("parent.registerAnother")}
          </button>
        </section>
      ) : (
        <form
          ref={form}
          onSubmit={submit}
          className="mx-auto max-w-3xl space-y-5"
        >
          <ol
            className="children-panel flex items-center justify-between gap-2 !p-3 sm:!p-4"
            aria-label={t("parent.progress")}
          >
            {STEPS.map((n) => (
              <li
                key={n}
                className="flex flex-1 items-center gap-2 text-sm font-semibold"
                aria-current={step === n ? "step" : undefined}
              >
                <span
                  className={`kids-avatar !h-9 !w-9 !text-sm ${
                    n < step ? "green" : n === step ? "" : "opacity-50"
                  }`}
                >
                  {n < step ? "✓" : n}
                </span>
                <span className={n === step ? "" : "hidden text-[#8a9589] sm:inline"}>
                  {stepTitle[n]}
                </span>
                {n < 3 && <span className="mx-1 hidden flex-1 border-t border-dashed border-[#d8dccd] sm:block" />}
              </li>
            ))}
          </ol>
          <p className="children-muted -mt-2 text-center text-xs">
            {t("common.stepOf", { step, total: 3 })}
          </p>
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px" }}
          >
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {step === 1 && (
            <div className="space-y-5 kids-fade-in">
              <section className="children-panel">
                <h2 className="text-2xl font-bold">{t("parent.familyTitle")}</h2>
                <label className="mt-5 block">
                  <span className="children-label">{t("parent.familyName")}</span>
                  <input
                    className="children-input lg"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    minLength={2}
                    maxLength={120}
                    placeholder={t("parent.familyNamePlaceholder")}
                    autoComplete="family-name"
                    required
                  />
                </label>
                <p className="children-muted mt-3">{t("parent.familyIntro")}</p>
              </section>
              {adults.map((a, index) => (
                <section className="children-panel space-y-4" key={index}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`kids-avatar ${index === 0 ? "green" : ""}`}>
                        {initials(`${a.firstName} ${a.lastName}`.trim() || String(index + 1))}
                      </span>
                      <h3 className="text-lg font-bold">
                        {index === 0
                          ? t("parent.primaryAdult")
                          : t("parent.additionalAdult", { n: index })}
                      </h3>
                    </div>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeAdult(index)}
                        className="kids-chip"
                      >
                        ✕ {t("parent.removeAdult")}
                      </button>
                    )}
                  </div>
                  <div className="children-grid">
                    {(["firstName", "lastName", "phone", "email"] as const).map((field) => (
                      <label key={field} className="block">
                        <span className="children-label">
                          {
                            {
                              firstName: t("common.firstName"),
                              lastName: t("common.lastName"),
                              phone: t("parent.contactPhone"),
                              email: t("common.email"),
                            }[field]
                          }
                        </span>
                        <input
                          className={input}
                          type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                          inputMode={field === "phone" ? "tel" : undefined}
                          autoComplete={
                            { firstName: "given-name", lastName: "family-name", phone: "tel", email: "email" }[field]
                          }
                          value={a[field]}
                          onChange={(e) =>
                            setAdults((rows) =>
                              rows.map((row, i) =>
                                i === index ? { ...row, [field]: e.target.value } : row,
                              ),
                            )
                          }
                          maxLength={field === "phone" ? 40 : field === "email" ? 254 : 80}
                          minLength={field === "phone" ? 5 : undefined}
                          required={field !== "email"}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <span className="children-label">{t("parent.relationship")}</span>
                    <div className="flex flex-wrap gap-2">
                      {RELATIONSHIP_KEYS.map((k) => {
                        const label = t(`relationships.${k}`);
                        return (
                          <button
                            key={k}
                            type="button"
                            className="kids-chip"
                            aria-pressed={a.relationship === label}
                            onClick={() =>
                              setAdults((rows) =>
                                rows.map((row, i) =>
                                  i === index ? { ...row, relationship: label } : row,
                                ),
                              )
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      className={input}
                      value={a.relationship}
                      onChange={(e) =>
                        setAdults((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, relationship: e.target.value } : row,
                          ),
                        )
                      }
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </div>
                </section>
              ))}
              <button
                type="button"
                className="children-button secondary"
                disabled={adults.length >= 4}
                onClick={() => setAdults([...adults, newAdult(defaultRelationship)])}
              >
                {t("parent.addAdult")}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 kids-fade-in">
              <section className="children-panel">
                <h2 className="text-2xl font-bold">{t("parent.childrenTitle")}</h2>
                <p className="children-muted mt-2">{t("parent.childrenIntro")}</p>
              </section>
              {children.map((c, index) => (
                <section className="children-panel space-y-4" key={index}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="kids-avatar plum">
                        {initials(`${c.firstName} ${c.lastName}`.trim() || String(index + 1))}
                      </span>
                      <h2 className="text-xl font-bold">{t("parent.child", { n: index + 1 })}</h2>
                      {c.birthDate && (
                        <span className="children-badge amber">{age(c.birthDate)}</span>
                      )}
                    </div>
                    {children.length > 1 && (
                      <button
                        type="button"
                        className="kids-chip"
                        onClick={() =>
                          setChildren((rows) => rows.filter((_, i) => i !== index))
                        }
                      >
                        ✕ {t("parent.removeChild")}
                      </button>
                    )}
                  </div>
                  <div className="children-grid">
                    {(["firstName", "lastName", "birthDate"] as const).map((field) => (
                      <label key={field} className="block">
                        <span className="children-label">
                          {
                            {
                              firstName: t("common.firstName"),
                              lastName: t("common.lastName"),
                              birthDate: t("parent.birthDate"),
                            }[field]
                          }
                        </span>
                        <input
                          className={input}
                          type={field === "birthDate" ? "date" : "text"}
                          value={c[field]}
                          onChange={(e) =>
                            setChildren((rows) =>
                              rows.map((row, i) =>
                                i === index ? { ...row, [field]: e.target.value } : row,
                              ),
                            )
                          }
                          max={field === "birthDate" ? localDateValue(new Date()) : undefined}
                          maxLength={80}
                          required
                        />
                      </label>
                    ))}
                  </div>
                  <fieldset className="rounded-xl bg-[#f6f7ed] p-4">
                    <legend className="text-sm font-semibold">{t("parent.pickupTitle")}</legend>
                    <p className="children-muted mb-3">{t("parent.pickupHint")}</p>
                    <div className="flex flex-wrap gap-2">
                      {adults.map((a, i) => {
                        const on = c.pickupAdults.includes(i);
                        return (
                          <button
                            key={i}
                            type="button"
                            className="kids-chip !px-4 !py-3 !text-sm"
                            aria-pressed={on}
                            onClick={() =>
                              setChildren((rows) =>
                                rows.map((row, n) =>
                                  n === index
                                    ? {
                                        ...row,
                                        pickupAdults: on
                                          ? row.pickupAdults.filter((v) => v !== i)
                                          : [...row.pickupAdults, i],
                                      }
                                    : row,
                                ),
                              )
                            }
                          >
                            {on ? "🔑 " : ""}
                            {`${a.firstName} ${a.lastName}`.trim() || t("parent.additionalAdult", { n: i })}
                            <span className="opacity-70"> · {a.relationship}</span>
                          </button>
                        );
                      })}
                    </div>
                    {!c.pickupAdults.length && (
                      <p className="mt-3 text-sm text-[#953c2e]">{t("parent.pickupRequired")}</p>
                    )}
                  </fieldset>
                  <label className="block">
                    <span className="children-label">{t("parent.careNotes")}</span>
                    <textarea
                      className="children-input min-h-24 text-base"
                      value={c.careNotes}
                      placeholder={t("parent.careNotesPlaceholder")}
                      onChange={(e) =>
                        setChildren((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, careNotes: e.target.value } : row,
                          ),
                        )
                      }
                      maxLength={2000}
                    />
                  </label>
                </section>
              ))}
              <button
                type="button"
                className="children-button secondary"
                disabled={children.length >= 6}
                onClick={() => setChildren([...children, newChild()])}
              >
                {t("parent.addChild")}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 kids-fade-in">
              <section className="children-panel space-y-4">
                <h2 className="text-2xl font-bold">{t("parent.consentTitle")}</h2>
                <p className="children-muted">{t("parent.consentIntro")}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="children-badge">{familyName}</span>
                  <span className="children-badge neutral">
                    {t("parent.summaryAdults", { count: adults.length })}
                  </span>
                  <span className="children-badge neutral">
                    {t("parent.summaryChildren", { count: children.length })}
                  </span>
                </div>
                <ul className="space-y-2">
                  {children.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f7f7f0] p-3 text-sm">
                      <span className="kids-avatar plum !h-8 !w-8 !text-xs">
                        {initials(`${c.firstName} ${c.lastName}`)}
                      </span>
                      <strong>
                        {c.firstName} {c.lastName}
                      </strong>
                      {c.birthDate && <span className="children-muted">· {age(c.birthDate)}</span>}
                      <span className="children-muted">
                        · 🔑{" "}
                        {c.pickupAdults
                          .map((n) => `${adults[n]?.firstName ?? ""} ${adults[n]?.lastName ?? ""}`.trim())
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="children-panel">
                <label className="flex items-start gap-3 text-base leading-7">
                  <input
                    className="mt-2 h-5 w-5"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>{t("parent.consent", { church: church || t("parent.theChurch") })}</span>
                </label>
                <p className="children-muted mt-3">🔒 {t("parent.privacy")}</p>
              </section>
            </div>
          )}

          {error && (
            <p role="alert" className="children-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {step > 1 && (
              <button
                className="children-button secondary lg"
                type="button"
                disabled={busy}
                onClick={() => goTo(step === 3 ? 2 : 1)}
              >
                {step === 3 ? t("parent.backChildren") : t("parent.backAdults")}
              </button>
            )}
            <button
              className="children-button lg flex-1"
              type="submit"
              disabled={busy || !church || (step === 3 && !consent)}
            >
              {busy
                ? t("parent.sending")
                : step === 1
                  ? t("parent.continueChildren")
                  : step === 2
                    ? t("parent.continueConsent")
                    : t("parent.send")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
