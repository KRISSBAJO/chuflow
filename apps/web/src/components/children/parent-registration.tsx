"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { ChildrenWelcome } from "./welcome";
const adult = () => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  relationship: "Parent / guardian",
});
const child = () => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  pickupAdults: [0],
  careNotes: "",
});
export function ParentRegistrationForm({ token }: { token: string }) {
  const [church, setChurch] = useState(""),
    [familyName, setFamilyName] = useState(""),
    [adults, setAdults] = useState([adult()]),
    [children, setChildren] = useState([child()]),
    [step, setStep] = useState(1),
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
        if (!r.ok)
          throw new Error(
            "This form is unavailable. Please contact the church.",
          );
        return (await r.json()) as { churchName: string };
      })
      .then((r) => {
        if (active) setChurch(r.churchName);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Form unavailable.");
      });
    return () => {
      active = false;
    };
  }, [token]);
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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
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
            : result.message || "Could not submit. Please try again.",
        );
      setReceived(true);
      setAdults([adult()]);
      setChildren([child()]);
      setFamilyName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <ChildrenWelcome
        title={
          church ? `Welcome to ${church}` : "A warm welcome for your family"
        }
        description="Register your family before your visit. Our children’s team will review the details and help you get ready for check-in."
      />
      {received ? (
        <section className="children-panel text-center">
          <p className="text-5xl" aria-hidden="true">
            ☀
          </p>
          <h2 className="mt-4 text-3xl font-bold">
            Thank you. Your registration is received.
          </h2>
          <p className="children-muted mx-auto mt-4 max-w-xl">
            The children’s team will review your details and confirm guardian
            and pickup arrangements. At your visit, ask the welcome team for
            your identification cards. This form does not check a child into a
            service.
          </p>
        </section>
      ) : (
        <form
          ref={form}
          onSubmit={submit}
          className="mx-auto max-w-3xl space-y-5"
        >
          <div className="flex gap-3" aria-label="Registration progress">
            <span className={`children-badge ${step === 1 ? "font-bold" : ""}`}>
              1 · Family & adults
            </span>
            <span className={`children-badge ${step === 2 ? "font-bold" : ""}`}>
              2 · Children & permissions
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px" }}
          >
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {step === 1 ? (
            <>
              <section className="children-panel">
                <h2 className="text-2xl font-bold">
                  Tell us about your family
                </h2>
                <label className="mt-5 block">
                  <span className="children-label">Family name</span>
                  <input
                    className="children-input"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    minLength={2}
                    maxLength={120}
                    placeholder="For example, the Adebajo family"
                    required
                  />
                </label>
                <p className="children-muted mt-3">
                  Please list yourself first as the parent or authorized
                  guardian. You can add other responsible adults and choose
                  pickup permissions separately for each child.
                </p>
              </section>
              {adults.map((a, index) => (
                <section className="children-panel space-y-4" key={index}>
                  <div className="flex justify-between">
                    <h3 className="text-lg font-bold">
                      {index === 0
                        ? "Parent / authorized guardian"
                        : `Additional adult ${index}`}
                    </h3>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeAdult(index)}
                        className="text-sm underline"
                      >
                        Remove adult
                      </button>
                    )}
                  </div>
                  <div className="children-grid">
                    {(
                      [
                        "firstName",
                        "lastName",
                        "phone",
                        "email",
                        "relationship",
                      ] as const
                    ).map((field) => (
                      <label key={field}>
                        <span className="children-label">
                          {
                            {
                              firstName: "First name",
                              lastName: "Last name",
                              phone: "Contact phone",
                              email: "Email (optional)",
                              relationship: "Relationship to child",
                            }[field]
                          }
                        </span>
                        <input
                          className="children-input"
                          type={
                            field === "email"
                              ? "email"
                              : field === "phone"
                                ? "tel"
                                : "text"
                          }
                          value={a[field]}
                          onChange={(e) =>
                            setAdults((rows) =>
                              rows.map((row, i) =>
                                i === index
                                  ? { ...row, [field]: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          maxLength={
                            field === "phone"
                              ? 40
                              : field === "email"
                                ? 254
                                : 80
                          }
                          minLength={
                            field === "phone"
                              ? 5
                              : field === "relationship"
                                ? 2
                                : undefined
                          }
                          required={field !== "email"}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
              <button
                type="button"
                className="children-button secondary"
                disabled={adults.length >= 4}
                onClick={() => setAdults([...adults, adult()])}
              >
                + Add another adult
              </button>
            </>
          ) : (
            <>
              {children.map((c, index) => (
                <section className="children-panel space-y-4" key={index}>
                  <div className="flex justify-between">
                    <h2 className="text-xl font-bold">Child {index + 1}</h2>
                    {children.length > 1 && (
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() =>
                          setChildren((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove child
                      </button>
                    )}
                  </div>
                  <div className="children-grid">
                    {(["firstName", "lastName", "birthDate"] as const).map(
                      (field) => (
                        <label key={field}>
                          <span className="children-label">
                            {
                              {
                                firstName: "First name",
                                lastName: "Last name",
                                birthDate: "Date of birth",
                              }[field]
                            }
                          </span>
                          <input
                            className="children-input"
                            type={field === "birthDate" ? "date" : "text"}
                            value={c[field]}
                            onChange={(e) =>
                              setChildren((rows) =>
                                rows.map((row, i) =>
                                  i === index
                                    ? { ...row, [field]: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            max={
                              field === "birthDate"
                                ? new Date().toISOString().slice(0, 10)
                                : undefined
                            }
                            maxLength={80}
                            required
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <fieldset className="rounded-xl bg-[#f6f7ed] p-4">
                    <legend className="text-sm font-semibold">
                      Who may collect this child?
                    </legend>
                    <p className="children-muted mb-3">
                      Select the authorized adults. The church will verify these
                      arrangements before issuing cards.
                    </p>
                    {adults.map((a, i) => (
                      <label
                        key={i}
                        className="my-3 flex items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={c.pickupAdults.includes(i)}
                          onChange={(e) =>
                            setChildren((rows) =>
                              rows.map((row, n) =>
                                n === index
                                  ? {
                                      ...row,
                                      pickupAdults: e.target.checked
                                        ? [...row.pickupAdults, i]
                                        : row.pickupAdults.filter(
                                            (v) => v !== i,
                                          ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                        {a.firstName} {a.lastName} · {a.relationship}
                      </label>
                    ))}
                  </fieldset>
                  <label className="block">
                    <span className="children-label">
                      Allergies, additional needs or care instructions
                      (optional)
                    </span>
                    <textarea
                      className="children-input min-h-24"
                      value={c.careNotes}
                      onChange={(e) =>
                        setChildren((rows) =>
                          rows.map((row, i) =>
                            i === index
                              ? { ...row, careNotes: e.target.value }
                              : row,
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
                onClick={() => setChildren([...children, child()])}
              >
                + Add another child
              </button>
              <section className="children-panel">
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  I am a parent or authorized guardian of these children. I
                  confirm the details and pickup choices are accurate, and give{" "}
                  {church || "the church"} permission to use these details for
                  children’s registration, care and related contact.
                </label>
                <p className="children-muted mt-3">
                  Only the authorized church team can review these details.
                  Please share only the information needed to care for your
                  children. Staff must approve the registration before cards are
                  issued.
                </p>
              </section>
            </>
          )}
          {error && (
            <p role="alert" className="children-error">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            {step === 2 && (
              <button
                className="children-button secondary"
                type="button"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                ← Family details
              </button>
            )}
            <button
              className="children-button flex-1"
              type="submit"
              disabled={
                busy ||
                !church ||
                (step === 2 &&
                  (!consent || children.some((c) => !c.pickupAdults.length)))
              }
            >
              {busy
                ? "Sending…"
                : step === 1
                  ? "Continue to children →"
                  : "Send registration for review"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
