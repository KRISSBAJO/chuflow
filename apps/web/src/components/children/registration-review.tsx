"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { apiGet, apiPost } from "@/lib/api";
import { ChildrenLocalTime } from "./local-time";
import { ChildrenQr } from "./receipt";
import { workspacePublicHref } from "@/lib/workspace-routing";
import type { GuestCustomAnswer } from "@/lib/guest-fields";
import {
  ageInMonths,
  initials,
  parseDateOnly,
  splitMonths,
} from "./records-utils";
export type ParentSubmission = {
  customAnswers?: GuestCustomAnswer[];
  _id: string;
  branchId: string;
  familyName: string;
  revision: number;
  status: string;
  processingAt?: string;
  canResume?: boolean;
  approvalStarted?: boolean;
  approvalAsMembers?: boolean;
  consentAt: string;
  reviewNote?: string;
  familyId?: string;
  adults: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    relationship: string;
  }[];
  children: {
    customAnswers?: GuestCustomAnswer[];
    firstName: string;
    lastName: string;
    birthDate: string;
    careNotes: string;
    pickupAdults: number[];
  }[];
  possibleDuplicates: { _id: string; name: string }[];
};

export function ParentRegistrationLink({ branchId, workspace }: { branchId: string; workspace?: string }) {
  const actionToast = useActionToast();

  const t = useTranslations("childrenRecords");
  const [data, setData] = useState<{ token?: string; enabled: boolean } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void apiGet<{ token?: string; enabled: boolean }>(
      `/children/registration-links/${branchId}`,
    )
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {
        if (active) setError(t("link.unavailable"));
      });
    return () => {
      active = false;
    };
  }, [branchId, t]);
  async function update(disable = false) {
    setBusy(true);
    setError("");
    try {
      setData(
        await apiPost(
          `/children/registration-links/${branchId}${disable ? "/disable" : ""}`,
          {},
        ),
      );
      setCopied(false);

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("link.updateError"));
      setError(e instanceof Error ? e.message : t("link.updateError"));
    } finally {
      setBusy(false);
    }
  }
  const url =
    data?.token && typeof window !== "undefined"
      ? window.location.origin + workspacePublicHref(`/children-register/${data.token}`, workspace)
      : "";
  return (
    <section className="children-panel space-y-4">
      <div className="flex items-start gap-3">
        <span className="kids-action-icon blue" aria-hidden="true">
          🔗
        </span>
        <div>
          <h2 className="text-xl font-bold">{t("link.title")}</h2>
          <p className="children-muted mt-1">{t("link.intro")}</p>
        </div>
      </div>
      {data?.enabled && url ? (
        <div className="flex flex-wrap items-center gap-5 rounded-xl bg-[#f5f7ec] p-4">
          <ChildrenQr code={url} />
          <div className="min-w-0 flex-1">
            <a
              className="break-all text-sm underline"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {url}
            </a>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="children-button secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => {
                      setCopied(true);
                      toast.success(t("link.copied"));
                    })
                    .catch(() => {
                      setError(t("link.copyError"));
                      toast.error(t("link.copyError"));
                    })
                }
              >
                {copied ? `✓ ${t("link.copied")}` : t("link.copy")}
              </button>
              <a
                className="children-button secondary"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("link.open")}
              </a>
            </div>
          </div>
        </div>
      ) : (
        data &&
        !data.enabled && (
          <p className="kids-banner amber">{t("link.disabled")}</p>
        )
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="children-button"
          disabled={busy || !data}
          onClick={() => void update()}
        >
          {data?.enabled ? t("link.replace") : t("link.enable")}
        </button>
        {data?.enabled && (
          <button
            type="button"
            className="children-button danger"
            disabled={busy}
            onClick={() => void update(true)}
          >
            {t("link.disable")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
    </section>
  );
}

function ExistingFamilyPicker({
  branchId,
  initial,
}: {
  branchId: string;
  initial: { _id: string; name: string }[];
}) {
  const t = useTranslations("childrenRecords");
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState(initial),
    [selected, setSelected] = useState<{ _id: string; name: string } | null>(
      null,
    );
  useEffect(() => {
    let active = true;
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      void apiGet<{ families: { _id: string; name: string }[] }>(
        `/children?branchId=${branchId}&search=${encodeURIComponent(search)}`,
      )
        .then((r) => {
          if (active) setRows(r.families);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, branchId]);
  return (
    <div>
      <input
        type="hidden"
        name="existingFamilyId"
        value={selected?._id || ""}
      />
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f1f5e8] p-4">
          <span className="flex items-center gap-3">
            <span className="kids-avatar green">{initials(selected.name)}</span>
            <strong>{selected.name}</strong>
          </span>
          <button
            type="button"
            className="kids-chip"
            onClick={() => setSelected(null)}
          >
            {t("review.change")}
          </button>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="children-label">{t("review.findFamily")}</span>
            <input
              className="children-input"
              placeholder={t("review.findFamilyPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setRows([]);
              }}
            />
          </label>
          <div className="mt-2 overflow-hidden rounded-xl border border-[#e4e8d8] bg-white">
            {rows.map((f) => (
              <button
                key={f._id}
                type="button"
                onClick={() => setSelected(f)}
                className="kids-row w-full px-3 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="kids-avatar">{initials(f.name)}</span>
                  {f.name}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ParentRegistrationReview({ row }: { row: ParentSubmission }) {
  const actionToast = useActionToast();

  const t = useTranslations("childrenRecords");
  const format = useFormatter();
  const router = useRouter();
  const [action, setAction] = useState("approve"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  type Key = Parameters<typeof t>[0];
  const statusKey = `queue.status.${row.status}` as Key;
  const statusLabel = t.has(statusKey) ? t(statusKey) : row.status;
  const statusTone =
    row.status === "pending"
      ? "amber"
      : row.status === "processing"
        ? "blue"
        : row.status === "rejected"
          ? "rose"
          : "";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await apiPost(`/children/registrations/${row._id}/review`, {
        action,
        expectedRevision: row.revision,
        note: f.get("note"),
        guardianVerified: f.get("guardianVerified") === "on",
        duplicatesChecked: f.get("duplicatesChecked") === "on",
        registerAsMembers: row.approvalStarted
          ? !!row.approvalAsMembers
          : f.get("registerAsMembers") === "on",
        allowDuplicate: f.get("allowDuplicate") === "on",
        ...(f.get("existingFamilyId")
          ? { existingFamilyId: f.get("existingFamilyId") }
          : {}),
      });
      router.refresh();

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("review.saveError"));
      setError(e instanceof Error ? e.message : t("review.saveError"));
    } finally {
      setBusy(false);
    }
  }
  const retry = row.canResume;
  const age = (birthDate: string) => {
    const m = ageInMonths(birthDate);
    if (m === null) return t("age.unknown");
    if (m === 0) return t("age.newborn");
    const { years, months } = splitMonths(m);
    if (years === 0) return t("age.months", { months });
    if (months === 0) return t("age.years", { years });
    return t("age.yearsMonths", { years, months });
  };
  return (
    <div className="space-y-5 kids-fade-in">
      <section className="children-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="kids-avatar green !h-14 !w-14 !text-xl">
              {initials(row.familyName)}
            </span>
            <div>
              <p className="children-kicker">{t("review.kicker")}</p>
              <h1 className="mt-1 text-3xl font-bold">{row.familyName}</h1>
            </div>
          </div>
          <span className={`children-badge ${statusTone}`}>{statusLabel}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="children-badge neutral">
            {t("review.adultsCount", { count: row.adults.length })}
          </span>
          <span className="children-badge neutral">
            {t("review.childrenCount", { count: row.children.length })}
          </span>
        </div>
        <p className="children-muted mt-3">
          {t("review.consentAt")} <ChildrenLocalTime value={row.consentAt} />
        </p>
      </section>

      {row.possibleDuplicates.length > 0 && (
        <div className="kids-banner amber">
          <div>
            <strong>⚠ {t("review.duplicatesTitle")}</strong>
            <p className="mt-1 text-sm">{t("review.duplicatesHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.possibleDuplicates.map((f) => (
              <Link
                key={f._id}
                className="kids-chip"
                target="_blank"
                href={`/children/families/${f._id}`}
              >
                {f.name} ↗
              </Link>
            ))}
          </div>
        </div>
      )}

      <section className="children-panel">
        <h2 className="text-xl font-bold">{t("review.adults")}</h2>
        <div className="mt-4 children-grid">
          {row.adults.map((a, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-[#f6f7ef] p-4">
              <span className="kids-avatar">
                {initials(`${a.firstName} ${a.lastName}`)}
              </span>
              <div className="min-w-0">
                <strong>
                  {a.firstName} {a.lastName}
                </strong>
                <p className="children-muted">
                  <span className="children-badge neutral mr-2">
                    {a.relationship}
                  </span>
                  <a className="underline" href={`tel:${a.phone}`}>
                    {a.phone}
                  </a>
                </p>
                {a.email && (
                  <p className="children-muted break-all">{a.email}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="children-panel">
        <h2 className="text-xl font-bold">{t("review.children")}</h2>
        {row.children.map((c, i) => (
          <div key={i} className="mt-4 rounded-xl border border-[#e3e8d8] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="kids-avatar plum">
                {initials(`${c.firstName} ${c.lastName}`)}
              </span>
              <div>
                <h3 className="font-bold">
                  {c.firstName} {c.lastName}
                </h3>
                <p className="children-muted">
                  {t("review.born", {
                    date: (() => {
                      const d = parseDateOnly(c.birthDate);
                      return d
                        ? format.dateTime(d, { dateStyle: "medium" })
                        : c.birthDate;
                    })(),
                  })}{" "}
                  · {age(c.birthDate)}
                </p>
              </div>
              {c.careNotes && (
                <span className="children-badge rose">
                  ⚕ {t("familyPage.careAlert")}
                </span>
              )}
            </div>
            <p className="children-label mt-3 !mb-1">
              {t("review.requestedPickup")}
            </p>
            <div className="flex flex-wrap gap-2">
              {c.pickupAdults.map((n) => (
                <span key={n} className="kids-chip active">
                  🔑 {row.adults[n]?.firstName} {row.adults[n]?.lastName}
                </span>
              ))}
            </div>
            {c.careNotes && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fff7e6] p-3 text-sm">
                <strong>{t("review.careNotes")}:</strong> {c.careNotes}
              </p>
            )}
          </div>
        ))}
      </section>

      {row.familyId && (
        <Link
          className="children-button lg"
          href={`/children/families/${row.familyId}`}
        >
          {t("review.openFamily")}
        </Link>
      )}
      {row.reviewNote && (
        <p className="children-panel">
          <strong>{t("review.reviewNote")}:</strong> {row.reviewNote}
        </p>
      )}
      {row.status === "pending" || retry ? (
        <form className="children-panel space-y-4" onSubmit={submit}>
          <h2 className="text-xl font-bold">{t("review.title")}</h2>
          {retry && <p className="kids-banner amber">{t("review.retry")}</p>}
          <label className="block">
            <span className="children-label">{t("review.decision")}</span>
            <select
              className="children-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="approve">{t("review.approve")}</option>
              {!row.approvalStarted && (
                <option value="handled">{t("review.handled")}</option>
              )}
              {!row.approvalStarted && (
                <option value="reject">{t("review.reject")}</option>
              )}
            </select>
          </label>
          {action === "approve" && (
            <fieldset className="space-y-3 rounded-xl bg-[#f7f7f0] p-4">
              <legend className="children-label">
                {t("review.checklist")}
              </legend>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  name="guardianVerified"
                  required
                  className="mt-1"
                />
                {t("review.guardianVerified")}
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  name="duplicatesChecked"
                  required
                  className="mt-1"
                />
                {t("review.duplicatesChecked")}
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  name="registerAsMembers"
                  defaultChecked={row.approvalAsMembers}
                  disabled={row.approvalStarted}
                  className="mt-1"
                />
                {t("review.registerAsMembers")}
              </label>
              {row.possibleDuplicates.length > 0 && (
                <label className="flex gap-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    name="allowDuplicate"
                    required
                    className="mt-1"
                  />
                  {t("review.allowDuplicate")}
                </label>
              )}
            </fieldset>
          )}
          {action === "handled" && (
            <>
              <p className="children-muted">{t("review.handledHint")}</p>
              <ExistingFamilyPicker
                branchId={row.branchId}
                initial={row.possibleDuplicates}
              />
            </>
          )}
          <label className="block">
            <span className="children-label">{t("review.note")}</span>
            <textarea
              className="children-input min-h-24"
              name="note"
              placeholder={t("review.notePlaceholder")}
              minLength={10}
              maxLength={2000}
              required
            />
          </label>
          {error && (
            <p role="alert" className="children-error">
              {error}
            </p>
          )}
          <button className="children-button lg" disabled={busy}>
            {busy ? t("common.saving") : t("review.save")}
          </button>
        </form>
      ) : (
        row.status === "processing" && (
          <p className="kids-banner">{t("review.processing")}</p>
        )
      )}
    </div>
  );
}
