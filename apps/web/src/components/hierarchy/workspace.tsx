"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type {
  HierarchyOverview,
  HierarchyUnit,
  HierarchyChurch,
} from "@/lib/hierarchy";
type Pastor = { _id: string; firstName: string; lastName: string };
export function HierarchyWorkspace({ data }: { data: HierarchyOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [kind, setKind] = useState("zone"),
    [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  async function save(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(
        "Saved. Church records remain connected to their existing local church.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const visibleChurches = data.branches.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(visibleChurches.length / 20));
  const currentPage = Math.min(page, pages);
  const districts = data.units.filter((u) => u.kind === "district");
  const children = (id: string) => data.units.filter((u) => u.parentId === id);
  function node(unit: HierarchyUnit) {
    return (
      <div key={unit._id} className="space-y-3">
        <details
          className="rounded-2xl border border-black/[0.06] bg-white p-5"
          open={unit.kind === "district"}
        >
          <summary className="cursor-pointer">
            <span className="text-xs uppercase tracking-wide text-[#b95c18]">
              {unit.kind}
              {!unit.isActive ? " · Inactive" : ""}
            </span>
            <span className="mt-1 block text-lg font-semibold">
              {unit.name}
            </span>
            <span className="mt-2 block text-sm text-[#6b6b6b]">
              {unit.churches} churches · {unit.members} member records ·{" "}
              {unit.guests} guest records
              {unit.partial ? " · Your accessible churches only" : ""}
            </span>
          </summary>
          <div className="mt-4 border-t border-black/5 pt-4 text-sm">
            <p>
              Headquarters: {unit.headquartersBranchId?.name || "Not appointed"}
            </p>
            <p className="mt-1">
              Resident & {unit.kind === "zone" ? "zonal" : unit.kind} pastor:{" "}
              {unit.pastorUserId
                ? `${unit.pastorUserId.firstName} ${unit.pastorUserId.lastName}`
                : "Not appointed"}
            </p>
            {data.canManage && (
              <Appointment
                key={`${unit._id}-${unit.revision}`}
                unit={unit}
                churches={data.branches}
                busy={busy}
                save={save}
              />
            )}
          </div>
        </details>
        {children(unit._id).length > 0 && (
          <div className="ml-3 space-y-3 border-l-2 border-orange-100 pl-4 sm:ml-6">
            {children(unit._id).map(node)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      <Card className="p-5">
        <p className="text-sm leading-6 text-[#6b6b6b]">
          District → Zones → Areas → Local churches. Headquarters are existing
          churches, so members, giving and attendance are counted once. Churches
          awaiting placement remain in their current district.
        </p>
        {data.context.assignments.length > 0 && (
          <p className="mt-3 text-sm font-medium">
            Your oversight:{" "}
            {data.context.assignments
              .map((a) => `${a.name} (${a.kind})`)
              .join(" · ")}
          </p>
        )}
      </Card>
      {data.canManage && data.selectedDistrictId && (
        <details className="app-card p-5">
          <summary className="cursor-pointer font-medium">
            Add an oversight level
          </summary>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void save(() =>
                apiPost("/hierarchy", {
                  kind,
                  districtId: data.selectedDistrictId,
                  name: String(d.get("name") || "District"),
                  ...(kind !== "district"
                    ? { parentId: d.get("parentId") }
                    : {}),
                }),
              );
            }}
          >
            <Field label="Level">
              <select
                className="ui-input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="district">District headquarters level</option>
                <option value="zone">Zone</option>
                <option value="area">Area</option>
              </select>
            </Field>
            {kind !== "district" && (
              <Field label="Parent">
                <select
                  className="ui-input"
                  name="parentId"
                  required
                  key={kind}
                >
                  <option value="">
                    Choose {kind === "zone" ? "district" : "zone"}
                  </option>
                  {data.units
                    .filter(
                      (u) =>
                        u.kind === (kind === "zone" ? "district" : "zone") &&
                        u.isActive,
                    )
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {kind !== "district" && (
              <Field label="Name">
                <input
                  className="ui-input"
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
            )}
            <div className="self-end">
              <Button type="submit" disabled={busy}>Add level</Button>
            </div>
          </form>
        </details>
      )}
      <section className="space-y-4" aria-label="Oversight tree">
        {districts.map(node)}
        {!data.units.length && (
          <Card className="p-8 text-sm text-[#6b6b6b]">
            No oversight levels have been configured. An authorized
            administrator can add the district headquarters level, then its
            zones and areas.
          </Card>
        )}
      </section>
      <Card className="p-5">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Local church placement</h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Assign existing churches without recreating or moving their
              records.
            </p>
          </div>
          <input
            className="ui-input max-w-sm"
            aria-label="Search churches"
            placeholder="Search local churches…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="mt-5 divide-y divide-black/5">
          {visibleChurches
            .slice((currentPage - 1) * 20, currentPage * 20)
            .map((c) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                key={c._id}
              >
                <div>
                  <Link
                    className="font-medium hover:underline"
                    href={`/dashboard?branchId=${c._id}`}
                  >
                    {c.name}
                  </Link>
                  <p className="mt-1 text-xs text-[#8a8780]">
                    {data.units.find((u) => u._id === c.zoneId)?.name ||
                      "Zone not assigned"}{" "}
                    ·{" "}
                    {data.units.find((u) => u._id === c.areaId)?.name ||
                      "Area not assigned"}
                  </p>
                </div>
                {data.canManage && (
                  <Placement
                    key={`${c._id}-${c.hierarchyRevision || 0}`}
                    church={c}
                    units={data.units}
                    busy={busy}
                    save={save}
                  />
                )}
              </div>
            ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>
            {visibleChurches.length} churches · Page {currentPage} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
function Placement({
  church,
  units,
  busy,
  save,
}: {
  church: HierarchyChurch;
  units: HierarchyUnit[];
  busy: boolean;
  save: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [unit, setUnit] = useState(church.areaId || church.zoneId || "");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save(() =>
          apiPatch(`/hierarchy/churches/${church._id}`, {
            expectedRevision: church.hierarchyRevision || 0,
            ...(unit ? { unitId: unit } : { unassigned: true }),
          }),
        );
      }}
    >
      <select
        aria-label={`Placement for ${church.name}`}
        className="ui-input max-w-xs"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      >
        <option value="">Unassigned in district</option>
        {units
          .filter((u) => u.kind !== "district" && u.isActive)
          .map((u) => (
            <option key={u._id} value={u._id}>
              {u.kind}: {u.name}
              {u.kind === "area"
                ? ` · ${units.find((parent) => parent._id === u.parentId)?.name || ""}`
                : ""}
            </option>
          ))}
      </select>
      <Button type="submit" variant="secondary" disabled={busy}>
        Save
      </Button>
    </form>
  );
}
function Appointment({
  unit,
  churches,
  busy,
  save,
}: {
  unit: HierarchyUnit;
  churches: HierarchyChurch[];
  busy: boolean;
  save: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [churchId, setChurchId] = useState(
      unit.headquartersBranchId?._id || "",
    ),
    [pastors, setPastors] = useState<Pastor[]>([]),
    [pastorId, setPastorId] = useState(unit.pastorUserId?._id || ""),
    [searchError, setSearchError] = useState("");
  const candidates = churches.filter(
    (c) =>
      c.status === "active" &&
      (unit.kind === "district" ||
        (unit.kind === "zone" ? c.zoneId === unit._id : c.areaId === unit._id)),
  );
  const requestId = useRef(0);
  async function selectChurch(id: string) {
    const current = ++requestId.current;
    setChurchId(id);
    setPastors([]);
    setPastorId("");
    setSearchError("");
    if (!id) return;
    try {
      const people = await apiGet<Pastor[]>(`/hierarchy/pastors/${id}`);
      if (current !== requestId.current) return;
      setPastors(people);
      if (people.length === 1) setPastorId(people[0]._id);
    } catch (e) {
      if (current !== requestId.current) return;
      setSearchError(
        e instanceof Error ? e.message : "Could not load the resident pastor.",
      );
    }
  }
  return (
    <div className="mt-5 space-y-3">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save(() =>
            apiPatch(`/hierarchy/units/${unit._id}`, {
              expectedRevision: unit.revision,
              headquartersBranchId: churchId,
              pastorUserId: pastorId,
            }),
          );
        }}
      >
        <Field label="Headquarters church">
          <select
            className="ui-input"
            required
            value={churchId}
            onChange={(e) => void selectChurch(e.target.value)}
          >
            <option value="">Choose a placed church</option>
            {candidates.map((c) => (
              <option value={c._id} key={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resident pastor">
          <select
            className="ui-input"
            required
            value={pastorId}
            onChange={(e) => setPastorId(e.target.value)}
          >
            <option value="">Select church to load pastor</option>
            {!pastors.length &&
              unit.pastorUserId &&
              pastorId === unit.pastorUserId._id && (
                <option value={pastorId}>
                  {unit.pastorUserId.firstName} {unit.pastorUserId.lastName}
                </option>
              )}
            {pastors.map((p) => (
              <option key={p._id} value={p._id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </Field>
        <div className="self-end">
          <Button type="submit" disabled={busy || !pastorId}>Save appointment</Button>
        </div>
      </form>
      {searchError && (
        <p role="alert" className="text-sm text-red-700">
          {searchError}
        </p>
      )}
      <p className="text-xs text-[#8a8780]">
        If no resident pastor appears, appoint the resident pastor to that local
        church in Users first.
      </p>
      <div className="flex flex-wrap gap-2">
        {unit.pastorUserId && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void save(() =>
                apiPatch(`/hierarchy/units/${unit._id}`, {
                  expectedRevision: unit.revision,
                  clearAppointment: true,
                }),
              )
            }
          >
            Clear oversight appointment
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void save(() =>
              apiPatch(`/hierarchy/units/${unit._id}`, {
                expectedRevision: unit.revision,
                isActive: !unit.isActive,
              }),
            )
          }
        >
          {unit.isActive ? "Deactivate level" : "Reactivate level"}
        </Button>
      </div>
    </div>
  );
}
