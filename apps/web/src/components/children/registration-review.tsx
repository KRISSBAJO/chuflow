"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { ChildrenLocalTime } from "./local-time";
import { ChildrenQr } from "./receipt";
export type ParentSubmission = {
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
    firstName: string;
    lastName: string;
    birthDate: string;
    careNotes: string;
    pickupAdults: number[];
  }[];
  possibleDuplicates: { _id: string; name: string }[];
};
export function ParentRegistrationLink({ branchId }: { branchId: string }) {
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
        if (active) setError("Link settings are unavailable.");
      });
    return () => {
      active = false;
    };
  }, [branchId]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update link.");
    } finally {
      setBusy(false);
    }
  }
  const url =
    data?.token && typeof window !== "undefined"
      ? `${window.location.origin}/children-register/${data.token}`
      : "";
  return (
    <section className="children-panel space-y-4">
      <h2 className="text-xl font-bold">Shareable parent registration form</h2>
      <p className="children-muted">
        Parents can register adults and children without a login. Every
        submission waits for a supervisor’s review.
      </p>
      {data?.enabled && url && (
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
            <div className="mt-3">
              <button
                type="button"
                className="children-button secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => setCopied(true))
                    .catch(() => setError("Copy the displayed link manually."))
                }
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="children-button"
          disabled={busy}
          onClick={() => void update()}
        >
          {data?.enabled
            ? "Replace link (disables old link)"
            : "Enable registration link"}
        </button>
        {data?.enabled && (
          <button
            type="button"
            className="children-button secondary"
            disabled={busy}
            onClick={() => void update(true)}
          >
            Disable link
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
        <div className="rounded-xl bg-[#f1f5e8] p-4">
          <strong>{selected.name}</strong>
          <button
            type="button"
            className="ml-4 text-sm underline"
            onClick={() => setSelected(null)}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="children-label">Find the existing family</span>
            <input
              className="children-input"
              placeholder="Type at least two letters of the family name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setRows([]);
              }}
            />
          </label>
          {rows.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() => setSelected(f)}
              className="block w-full border-b border-[#e4e8d8] p-3 text-left"
            >
              {f.name} →
            </button>
          ))}
        </>
      )}
    </div>
  );
}
export function ParentRegistrationReview({ row }: { row: ParentSubmission }) {
  const router = useRouter();
  const [action, setAction] = useState("approve"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }
  const retry = row.canResume;
  return (
    <div className="space-y-5">
      <section className="children-panel">
        <p className="children-kicker">Parent submission · {row.status}</p>
        <h1 className="mt-2 text-3xl font-bold">{row.familyName}</h1>
        <p className="children-muted mt-3">
          Guardian permission recorded{" "}
          <ChildrenLocalTime value={row.consentAt} />.
        </p>
      </section>
      <section className="children-panel">
        <h2 className="text-xl font-bold">Adults</h2>
        <div className="mt-4 children-grid">
          {row.adults.map((a, i) => (
            <div key={i} className="rounded-xl bg-[#f6f7ef] p-4">
              <strong>
                {a.firstName} {a.lastName}
              </strong>
              <p className="children-muted">
                {a.relationship} · {a.phone}
              </p>
              <p className="children-muted">{a.email}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="children-panel">
        <h2 className="text-xl font-bold">
          Children and requested pickup adults
        </h2>
        {row.children.map((c, i) => (
          <div key={i} className="mt-4 rounded-xl border border-[#e3e8d8] p-4">
            <h3 className="font-bold">
              {c.firstName} {c.lastName}
            </h3>
            <p className="children-muted">Born {c.birthDate}</p>
            <p className="children-muted">
              Requested pickup:{" "}
              {c.pickupAdults
                .map(
                  (i) =>
                    `${row.adults[i]?.firstName} ${row.adults[i]?.lastName}`,
                )
                .join(", ")}
            </p>
            {c.careNotes && (
              <p className="mt-3 whitespace-pre-wrap text-sm">
                Care instructions: {c.careNotes}
              </p>
            )}
          </div>
        ))}
      </section>
      {row.possibleDuplicates.length > 0 && (
        <section className="children-panel">
          <h2 className="text-lg font-bold text-amber-800">
            Possible existing families — check before creating records
          </h2>
          {row.possibleDuplicates.map((f) => (
            <Link
              key={f._id}
              className="mt-3 block underline"
              target="_blank"
              href={`/children/families/${f._id}`}
            >
              {f.name} ↗
            </Link>
          ))}
        </section>
      )}
      {row.familyId && (
        <Link
          className="children-button"
          href={`/children/families/${row.familyId}`}
        >
          Open family and issue identification cards →
        </Link>
      )}
      {row.reviewNote && (
        <p className="children-panel">Review note: {row.reviewNote}</p>
      )}
      {row.status === "pending" || retry ? (
        <form className="children-panel space-y-4" onSubmit={submit}>
          <h2 className="text-xl font-bold">Supervisor review</h2>
          {retry && (
            <p className="children-muted">
              An earlier review was interrupted. Retrying resumes the same
              registration without duplicating its records.
            </p>
          )}
          <label className="block">
            <span className="children-label">Decision</span>
            <select
              className="children-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="approve">Approve as a new family</option>
              {!row.approvalStarted && (
                <option value="handled">Handled with an existing family</option>
              )}
              {!row.approvalStarted && (
                <option value="reject">Decline this submission</option>
              )}
            </select>
          </label>
          {action === "approve" && (
            <>
              <label className="flex gap-3 text-sm">
                <input type="checkbox" name="guardianVerified" required />I have
                verified the submitting guardian and the pickup arrangements.
              </label>
              <label className="flex gap-3 text-sm">
                <input type="checkbox" name="duplicatesChecked" required />I
                checked for existing family and child records.
              </label>
              <label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  name="registerAsMembers"
                  defaultChecked={row.approvalAsMembers}
                  disabled={row.approvalStarted}
                />
                Register these children as members (otherwise, visiting
                children).
              </label>
              {row.possibleDuplicates.length > 0 && (
                <label className="flex gap-3 text-sm text-amber-900">
                  <input type="checkbox" name="allowDuplicate" required />I
                  verified that the possible matches are different families.
                  Create a separate family.
                </label>
              )}
            </>
          )}
          {action === "handled" && (
            <>
              <p className="children-muted">
                Review and update the existing family separately. This action
                links the submission for your records; it does not overwrite
                permissions or create new children.
              </p>
              <ExistingFamilyPicker
                branchId={row.branchId}
                initial={row.possibleDuplicates}
              />
            </>
          )}
          <label className="block">
            <span className="children-label">Review / verification note</span>
            <textarea
              className="children-input min-h-24"
              name="note"
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
          <button className="children-button" disabled={busy}>
            {busy ? "Saving…" : "Save review"}
          </button>
        </form>
      ) : (
        row.status === "processing" && (
          <p className="children-panel children-muted">
            A supervisor is processing this registration. Refresh shortly to see
            the result.
          </p>
        )
      )}
    </div>
  );
}
