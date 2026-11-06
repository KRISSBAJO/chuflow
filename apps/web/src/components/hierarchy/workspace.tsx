"use client";
import { toast } from "sonner";
import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type {
  HierarchyOverview,
  HierarchyUnit,
  HierarchyChurch,
} from "@/lib/hierarchy";
type Pastor = { _id: string; firstName: string; lastName: string };
type UnitKind = HierarchyUnit["kind"];

function isUnitKind(value: string): value is UnitKind {
  return value === "district" || value === "zone" || value === "area";
}

export function HierarchyWorkspace({
  data,
  unitId,
}: {
  data: HierarchyOverview;
  unitId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("org.hierarchy");
  const tCommon = useTranslations("common");
  const kindLabel = (kind: string) =>
    isUnitKind(kind) ? t(`kinds.${kind}`) : kind;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [kind, setKind] = useState("zone"),
    [search, setSearch] = useState("");

  async function save(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      await action();
      toast.success(t("saved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  const selected = data.units.find((u) => u._id === unitId);
  const unitHref = (id: string) =>
    `/hierarchy/${encodeURIComponent(id)}?districtId=${encodeURIComponent(data.selectedDistrictId || "")}`;
  const scopedChurches = selected
    ? data.branches.filter(
        (c) =>
          selected.kind === "district" ||
          (selected.kind === "zone"
            ? c.zoneId === selected._id
            : c.areaId === selected._id),
      )
    : [];
  const visibleChurches = scopedChurches.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(visibleChurches.length / 20));
  const currentPage = Math.min(page, pages);
  const listedUnits = data.units.filter((u) =>
    selected ? u.parentId === selected._id : u.kind === "district",
  );
  const [levelSearch, setLevelSearch] = useState("");
  const [levelPage, setLevelPage] = useState(1);
  const matchingUnits = listedUnits.filter((u) =>
    u.name.toLowerCase().includes(levelSearch.toLowerCase()),
  );
  const levelPages = Math.max(1, Math.ceil(matchingUnits.length / 20));
  const currentLevelPage = Math.min(levelPage, levelPages);
  const unitStats = (unit: HierarchyUnit) =>
    t("unitStats", {
      churches: unit.churches,
      members: unit.members,
      guests: unit.guests,
    }) + (unit.partial ? t("partialSuffix") : "");
  const sectionHeading = selected
    ? selected.kind === "district"
      ? t("headingZones")
      : selected.kind === "zone"
        ? t("headingAreas")
        : t("headingAreaChurches")
    : t("headingDistricts");
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

      {selected && (
        <>
          <Link
            className="inline-flex items-center gap-2 text-sm hover:underline"
            href={
              selected.parentId
                ? unitHref(selected.parentId)
                : `/hierarchy?districtId=${data.selectedDistrictId}`
            }
          >
            {t("backTo", {
              name:
                data.units.find((u) => u._id === selected.parentId)?.name ||
                t("hierarchyFallback"),
            })}
          </Link>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wide text-[#b95c18]">
              {kindLabel(selected.kind)}
              {!selected.isActive ? t("inactiveSuffix") : ""}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2>
            <p className="mt-2 text-sm text-[#6b6b6b]">{unitStats(selected)}</p>
            <p className="mt-4 text-sm">
              {t("headquarters", {
                name: selected.headquartersBranchId?.name || t("notAppointed"),
              })}
            </p>
            <p className="mt-1 text-sm">
              {t("residentPastorLine", {
                level: t(`levelAdjective.${selected.kind}`),
                name: selected.pastorUserId
                  ? `${selected.pastorUserId.firstName} ${selected.pastorUserId.lastName}`
                  : t("notAppointed"),
              })}
            </p>
            <p className="mt-3 text-sm font-medium text-[#6b6b6b]">
              {selected.pastorVisibilityEnabled
                ? t("visibilityEnabled", { name: selected.name })
                : t("visibilityLocal")}
            </p>
            {data.canManage && (
              <details className="mt-5 border-t border-black/5 pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {t("manageAppointment")}
                </summary>
                <Appointment
                  key={`${selected._id}-${selected.revision}`}
                  unit={selected}
                  churches={data.branches}
                  busy={busy}
                  save={save}
                />
              </details>
            )}
          </Card>
        </>
      )}
      <Card className="p-5">
        <p className="text-sm leading-6 text-[#6b6b6b]">{t("intro")}</p>
        {data.context.assignments.length > 0 && (
          <p className="mt-3 text-sm font-medium">
            {t("yourOversight", {
              list: data.context.assignments
                .map((a) => `${a.name} (${kindLabel(a.kind)})`)
                .join(" · "),
            })}
          </p>
        )}
      </Card>
      {data.canManage && data.selectedDistrictId && (
        <details className="app-card p-5">
          <summary className="cursor-pointer font-medium">
            {t("addLevel")}
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
            <Field label={t("level")}>
              <select
                className="ui-input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="district">{t("levelDistrict")}</option>
                <option value="zone">{t("levelZone")}</option>
                <option value="area">{t("levelArea")}</option>
              </select>
            </Field>
            {kind !== "district" && (
              <Field label={t("parent")}>
                <select
                  className="ui-input"
                  name="parentId"
                  required
                  key={kind}
                >
                  <option value="">
                    {kind === "zone" ? t("chooseDistrict") : t("chooseZone")}
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
              <Field label={tCommon("name")}>
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
              <Button type="submit" disabled={busy}>
                {t("addLevelButton")}
              </Button>
            </div>
          </form>
        </details>
      )}
      <section className="space-y-4" aria-label={t("sectionLevels")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{sectionHeading}</h2>
          {listedUnits.length > 0 && (
            <input
              className="ui-input max-w-sm"
              aria-label={t("searchLevels")}
              placeholder={t("searchLevelsPlaceholder")}
              value={levelSearch}
              onChange={(e) => {
                setLevelSearch(e.target.value);
                setLevelPage(1);
              }}
            />
          )}
        </div>
        {matchingUnits
          .slice((currentLevelPage - 1) * 20, currentLevelPage * 20)
          .map((unit) => (
            <Link
              key={unit._id}
              href={unitHref(unit._id)}
              className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:border-orange-300"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-[#b95c18]">
                  {kindLabel(unit.kind)}
                  {!unit.isActive ? t("inactiveSuffix") : ""}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{unit.name}</h3>
                <p className="mt-2 text-sm text-[#6b6b6b]">{unitStats(unit)}</p>
              </div>
              <span aria-hidden="true" className="text-xl text-[#b95c18]">
                →
              </span>
            </Link>
          ))}
        {!matchingUnits.length && selected?.kind !== "area" && (
          <p className="text-sm text-[#6b6b6b]">
            {levelSearch ? t("noMatchingLevels") : t("noLevels")}
          </p>
        )}
        {levelPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span>
              {tCommon("pageOf", { page: currentLevelPage, total: levelPages })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={currentLevelPage === 1}
                onClick={() => setLevelPage(currentLevelPage - 1)}
              >
                {tCommon("previous")}
              </Button>
              <Button
                variant="secondary"
                disabled={currentLevelPage === levelPages}
                onClick={() => setLevelPage(currentLevelPage + 1)}
              >
                {tCommon("next")}
              </Button>
            </div>
          </div>
        )}
      </section>
      {selected && (
        <Card className="p-5">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {t("localChurches", { name: selected.name })}
              </h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">{t("assignHint")}</p>
            </div>
            <FilterPanel className="w-full p-3 sm:max-w-sm">
              <input
                className="ui-input max-w-sm"
                aria-label={t("searchChurches")}
                placeholder={t("searchChurchesPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </FilterPanel>
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
                        t("zoneNotAssigned")}{" "}
                      ·{" "}
                      {data.units.find((u) => u._id === c.areaId)?.name ||
                        t("areaNotAssigned")}
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
              {t("churchesPage", {
                count: visibleChurches.length,
                page: currentPage,
                total: pages,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                {tCommon("previous")}
              </Button>
              <Button
                variant="secondary"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                {tCommon("next")}
              </Button>
            </div>
          </div>
        </Card>
      )}
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
  const t = useTranslations("org.hierarchy");
  const tCommon = useTranslations("common");
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
        aria-label={t("placementFor", { name: church.name })}
        className="ui-input max-w-xs"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      >
        <option value="">{t("unassigned")}</option>
        {units
          .filter((u) => u.kind !== "district" && u.isActive)
          .map((u) => (
            <option key={u._id} value={u._id}>
              {t(`kinds.${u.kind}`)}: {u.name}
              {u.kind === "area"
                ? ` · ${units.find((parent) => parent._id === u.parentId)?.name || ""}`
                : ""}
            </option>
          ))}
      </select>
      <Button type="submit" variant="secondary" disabled={busy}>
        {tCommon("save")}
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
  const t = useTranslations("org.hierarchy");
  const [churchId, setChurchId] = useState(
      unit.headquartersBranchId?._id || "",
    ),
    [pastors, setPastors] = useState<Pastor[]>([]),
    [pastorId, setPastorId] = useState(unit.pastorUserId?._id || ""),
    [searchError, setSearchError] = useState("");
  const [visibilityEnabled, setVisibilityEnabled] = useState(
    unit.pastorVisibilityEnabled === true,
  );
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
    setVisibilityEnabled(false);
    setSearchError("");
    if (!id) return;
    try {
      const people = await apiGet<Pastor[]>(`/hierarchy/pastors/${id}`);
      if (current !== requestId.current) return;
      setPastors(people);
      if (people.length === 1) setPastorId(people[0]._id);
    } catch (e) {
      if (current !== requestId.current) return;
      setSearchError(e instanceof Error ? e.message : t("pastorLoadError"));
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
              pastorVisibilityEnabled: visibilityEnabled,
            }),
          );
        }}
      >
        <Field label={t("headquartersChurch")}>
          <select
            className="ui-input"
            required
            value={churchId}
            onChange={(e) => void selectChurch(e.target.value)}
          >
            <option value="">{t("choosePlacedChurch")}</option>
            {candidates.map((c) => (
              <option value={c._id} key={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("residentPastor")}>
          <select
            className="ui-input"
            required
            value={pastorId}
            onChange={(e) => {
              setPastorId(e.target.value);
              setVisibilityEnabled(false);
            }}
          >
            <option value="">{t("selectChurchToLoad")}</option>
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
        <div className="rounded-xl border border-black/5 bg-white p-4 sm:col-span-3">
          <label className="flex items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-1"
              checked={visibilityEnabled}
              disabled={busy || !pastorId || !unit.isActive}
              onChange={(event) => setVisibilityEnabled(event.target.checked)}
            />
            <span>
              {t("visibilityEnable")}
              <span className="mt-1 block text-xs font-normal leading-5 text-[#6b6b6b]">
                {t("visibilityHint", { name: unit.name })}
              </span>
            </span>
          </label>
        </div>
        <div className="self-end">
          <Button type="submit" disabled={busy || !pastorId}>
            {t("saveAppointment")}
          </Button>
        </div>
      </form>
      {searchError && (
        <p role="alert" className="text-sm text-red-700">
          {searchError}
        </p>
      )}
      <p className="text-xs text-[#8a8780]">{t("pastorHint")}</p>
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
            {t("clearAppointment")}
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
          {unit.isActive ? t("deactivate") : t("reactivate")}
        </Button>
      </div>
    </div>
  );
}
