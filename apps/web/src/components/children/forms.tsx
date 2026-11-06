"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  ChildrenOptions,
  Family,
  Guardian,
  ChildProfile,
} from "@/lib/children";
const blankGuardian = (): Omit<Guardian, "id"> & { id?: string } => ({
  firstName: "",
  lastName: "",
  phone: "",
  relationship: "Parent",
  canCheckIn: true,
});
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="children-label">{label}</span>
      {children}
    </label>
  );
}
function AdultMemberLink({
  branchId,
  value,
  onChange,
}: {
  branchId: string;
  value?: string;
  onChange: (
    id: string,
    person?: {
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
    },
  ) => void;
}) {
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState<
      {
        _id: string;
        firstName: string;
        lastName: string;
        phone?: string;
        email?: string;
      }[]
    >([]);
  useEffect(() => {
    let active = true;
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      void apiGet<typeof rows>(
        `/children/adult-members?branchId=${branchId}&search=${encodeURIComponent(search)}`,
      )
        .then((r) => {
          if (active) setRows(r);
        })
        .catch(() => {
          if (active) setRows([]);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [branchId, search]);
  return (
    <div className="rounded-xl bg-[#f6f7ef] p-3">
      <span className="children-label">
        Link to an existing adult member (optional)
      </span>
      {value ? (
        <div className="flex justify-between gap-2 text-sm">
          <span>Member linked</span>
          <button type="button" onClick={() => onChange("")}>
            Remove link
          </button>
        </div>
      ) : (
        <>
          <input
            className="children-input"
            aria-label="Search adult members"
            placeholder="Type a member’s name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setRows([]);
            }}
          />
          {search.trim().length >= 2 &&
            rows.map((p) => (
              <button
                key={p._id}
                type="button"
                className="block w-full border-b border-[#dde4d5] p-3 text-left text-sm"
                onClick={() => {
                  onChange(p._id, p);
                  setSearch("");
                  setRows([]);
                }}
              >
                {p.firstName} {p.lastName}
              </button>
            ))}
        </>
      )}
      <p className="children-muted mt-2">
        Guardians do not need a membership or login.
      </p>
    </div>
  );
}
export function FamilyForm({
  options,
  family,
  initialBranchId,
}: {
  options: ChildrenOptions;
  family?: Family;
  initialBranchId?: string;
}) {
  const router = useRouter();
  const [branch, setBranch] = useState(
      family?.branchId || initialBranchId || options.branches[0]?._id || "",
    ),
    [guardians, setGuardians] = useState<
      (Omit<Guardian, "id"> & { id?: string })[]
    >(family?.guardians || [blankGuardian()]);
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
      setError(e instanceof Error ? e.message : "Could not save family.");
      setBusy(false);
    }
  }
  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="children-panel space-y-4">
        <h1 className="text-3xl font-bold">
          {family ? "Update family" : "A family comes first"}
        </h1>
        <p className="children-muted">
          Register the responsible adults, then link each child and choose
          exactly who may collect them.
        </p>
        <Field label="Church">
          <select
            className="children-input"
            value={branch}
            disabled={!!family}
            onChange={(e) => {
              setBranch(e.target.value);
              setGuardians([blankGuardian()]);
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
        <Field label="Family name">
          <input
            className="children-input"
            name="name"
            defaultValue={family?.name}
            placeholder="For example, The Adebajo family"
            minLength={2}
            maxLength={120}
            required
          />
        </Field>
      </div>
      {guardians.map((g, i) => (
        <section key={g.id || i} className="children-panel space-y-4">
          <div className="flex justify-between">
            <h2 className="text-lg font-bold">Adult {i + 1}</h2>
            {guardians.length > 1 && (
              <button
                type="button"
                className="text-sm text-[#99523c]"
                onClick={() =>
                  setGuardians((rows) => rows.filter((_, n) => n !== i))
                }
              >
                Remove
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
            <Field label="First name">
              <input
                className="children-input"
                value={g.firstName}
                onChange={(e) => patch(i, { firstName: e.target.value })}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Last name">
              <input
                className="children-input"
                value={g.lastName}
                onChange={(e) => patch(i, { lastName: e.target.value })}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Phone / emergency contact">
              <input
                type="tel"
                className="children-input"
                value={g.phone}
                onChange={(e) => patch(i, { phone: e.target.value })}
                minLength={5}
                maxLength={40}
                required
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                className="children-input"
                value={g.email || ""}
                onChange={(e) => patch(i, { email: e.target.value })}
              />
            </Field>
            <Field label="Relationship">
              <input
                className="children-input"
                value={g.relationship}
                onChange={(e) => patch(i, { relationship: e.target.value })}
                placeholder="Parent, guardian, emergency contact"
                minLength={2}
                maxLength={60}
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={g.canCheckIn}
              onChange={(e) => patch(i, { canCheckIn: e.target.checked })}
            />
            May bring linked children for check-in
          </label>
          <p className="children-muted">
            Pickup permission is set separately on each child’s record.
          </p>
        </section>
      ))}
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="children-button secondary"
          type="button"
          disabled={guardians.length >= 12}
          onClick={() => setGuardians([...guardians, blankGuardian()])}
        >
          + Add adult
        </button>
        <button
          className="children-button"
          type="submit"
          disabled={busy || !branch}
        >
          {busy ? "Saving…" : "Save family"}
        </button>
      </div>
    </form>
  );
}
export function ChildForm({
  family,
  child,
}: {
  family: Family;
  child?: ChildProfile;
}) {
  const router = useRouter();
  const registrationKey = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [links, setLinks] = useState(
      child?.guardianIds || family.guardians.map((g) => g.id),
    ),
    [pickup, setPickup] = useState(child?.pickupGuardianIds || []);

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
      isMember: f.get("isMember") === "on",
      isActive: f.get("isActive") === "on",
      photoConsent: f.get("photoConsent") === "on",
      ...(f.get("photoUrl") ? { photoUrl: f.get("photoUrl") } : {}),
      ...(child ? { expectedRevision: child.revision } : {}),
    };
    try {
      if (child) await apiPatch(`/children/profiles/${child._id}`, body);
      else await apiPost("/children/profiles", body);
      router.push(`/children/families/${family._id}?saved=1`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save child.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="children-panel space-y-5">
        <p className="children-kicker">{family.name}</p>
        <h1 className="text-3xl font-bold">
          {child ? "Update child" : "Every child, known by name"}
        </h1>
        <div className="children-grid">
          <Field label="First name">
            <input
              className="children-input"
              name="firstName"
              defaultValue={child?.firstName}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Last name">
            <input
              className="children-input"
              name="lastName"
              defaultValue={child?.lastName}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Date of birth">
            <input
              className="children-input"
              type="date"
              name="birthDate"
              defaultValue={child?.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isMember"
            defaultChecked={child?.isMember ?? true}
          />
          Register as a child member (also appears in Members)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={child?.isActive ?? true}
          />
          Active children’s ministry record
        </label>
      </section>
      <section className="children-panel">
        <h2 className="text-xl font-bold">Who cares for this child?</h2>
        <p className="children-muted mt-2">
          A family relationship does not automatically give pickup permission.
          Choose the authorized adults explicitly.
        </p>
        <div className="mt-4 space-y-3">
          {family.guardians.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f7f0] p-4"
            >
              <div>
                <label className="flex gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={links.includes(g.id)}
                    onChange={(e) => toggle(g.id, e.target.checked)}
                  />
                  {g.firstName} {g.lastName}
                </label>
                <p className="children-muted ml-6">
                  {g.relationship} ·{" "}
                  {g.canCheckIn ? "May check in" : "Emergency/contact only"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!links.includes(g.id)}
                  checked={pickup.includes(g.id)}
                  onChange={(e) =>
                    setPickup((ids) =>
                      e.target.checked
                        ? [...ids, g.id]
                        : ids.filter((id) => id !== g.id),
                    )
                  }
                />
                Authorized to collect
              </label>
            </div>
          ))}
        </div>
      </section>
      <section className="children-panel space-y-4">
        <h2 className="text-xl font-bold">Care and pickup instructions</h2>
        <p className="children-muted">
          Visible to the authorized children’s team. These details are not
          printed on name labels or shown at the public kiosk.
        </p>
        <Field label="Allergies, additional needs and care instructions">
          <textarea
            className="children-input min-h-28"
            name="careNotes"
            defaultValue={child?.careNotes}
            maxLength={3000}
          />
        </Field>
        <Field label="Pickup instructions or restrictions">
          <textarea
            className="children-input min-h-24"
            name="pickupNotes"
            defaultValue={child?.pickupNotes}
            maxLength={3000}
          />
        </Field>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Optional photograph
          </summary>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="photoConsent"
                defaultChecked={child?.photoConsent}
              />
              Guardian’s photograph permission has been recorded
            </label>
            <Field label="Private HTTPS photo URL">
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
      <button className="children-button" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save child"}
      </button>
    </form>
  );
}
export function ChildSessionForm({
  options,
  initialBranchId,
}: {
  options: ChildrenOptions;
  initialBranchId?: string;
}) {
  const router = useRouter();
  const registrationKey = useRef("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [rooms, setRooms] = useState([
    { name: "Nursery", minMonths: 0, maxMonths: 35, capacity: 20 },
    { name: "Preschool", minMonths: 36, maxMonths: 71, capacity: 20 },
    { name: "Junior children", minMonths: 72, maxMonths: 155, capacity: 25 },
  ]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!registrationKey.current) registrationKey.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await apiPost<{ _id: string }>("/children/sessions", {
        registrationKey: registrationKey.current,
        branchId: f.get("branchId"),
        name: f.get("name"),
        startsAt: new Date(String(f.get("startsAt"))).toISOString(),
        endsAt: new Date(String(f.get("endsAt"))).toISOString(),
        rooms,
      });
      router.push(`/children/sessions/${r._id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open session.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="children-panel space-y-4">
        <h1 className="text-3xl font-bold">Make room for a lovely day</h1>
        <p className="children-muted">
          One session for one service or event. Children are counted once in
          this session, even when transferred between rooms.
        </p>
        <Field label="Church">
          <select
            name="branchId"
            className="children-input"
            defaultValue={initialBranchId || options.branches[0]?._id}
            required
          >
            {options.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service / session name">
          <input
            name="name"
            className="children-input"
            placeholder="Sunday first service · Children’s ministry"
            minLength={2}
            maxLength={120}
            required
          />
        </Field>
        <div className="children-grid">
          <Field label="Opens (your local time)">
            <input
              type="datetime-local"
              name="startsAt"
              className="children-input"
              required
            />
          </Field>
          <Field label="Ends (your local time)">
            <input
              type="datetime-local"
              name="endsAt"
              className="children-input"
              required
            />
          </Field>
        </div>
      </section>
      <section className="children-panel space-y-4">
        <h2 className="text-xl font-bold">Classrooms</h2>
        <p className="children-muted">
          Age ranges are in completed months. 36 months means age 3. Capacity is
          enforced when checking in.
        </p>
        {rooms.map((r, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-xl bg-[#f6f7ee] p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            {(["name", "minMonths", "maxMonths", "capacity"] as const).map(
              (field) => (
                <Field
                  key={field}
                  label={
                    field === "name"
                      ? "Room name"
                      : field === "capacity"
                        ? "Capacity"
                        : field === "minMonths"
                          ? "Min months"
                          : "Max months"
                  }
                >
                  <input
                    className="children-input"
                    type={field === "name" ? "text" : "number"}
                    min={field === "capacity" ? 1 : 0}
                    max={
                      field === "capacity"
                        ? 500
                        : field === "name"
                          ? undefined
                          : 216
                    }
                    value={r[field]}
                    onChange={(e) =>
                      setRooms((rows) =>
                        rows.map((row, n) =>
                          i === n
                            ? {
                                ...row,
                                [field]:
                                  field === "name"
                                    ? e.target.value
                                    : Number(e.target.value),
                              }
                            : row,
                        ),
                      )
                    }
                    required
                  />
                </Field>
              ),
            )}
            <button
              type="button"
              className="self-end p-3 text-sm"
              disabled={rooms.length === 1}
              onClick={() => setRooms((rows) => rows.filter((_, n) => i !== n))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="children-button secondary"
          disabled={rooms.length >= 20}
          onClick={() =>
            setRooms([
              ...rooms,
              { name: "", minMonths: 0, maxMonths: 215, capacity: 20 },
            ])
          }
        >
          + Add classroom
        </button>
      </section>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      <button type="submit" className="children-button" disabled={busy}>
        {busy ? "Opening…" : "Open session"}
      </button>
    </form>
  );
}
