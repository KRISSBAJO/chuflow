import type { ServiceUnitSummary } from "@/lib/types";

export function MemberServiceGroups({
  units,
  selected = [],
}: {
  units: ServiceUnitSummary[];
  selected?: string[];
}) {
  const chosen = new Set(selected);
  const available = units.filter(
    (unit) => unit.isActive || chosen.has(unit._id),
  );
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium">
        Service groups — select all that apply
      </legend>
      <p className="mb-3 mt-1 text-xs text-[#8a8780]">
        A member can serve in more than one group. Uncheck every group to leave
        the member unassigned.
      </p>
      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
        {available.map((unit) => (
          <label
            key={unit._id}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3 text-sm"
          >
            <input
              type="checkbox"
              name="serviceUnitIds"
              value={unit._id}
              defaultChecked={chosen.has(unit._id)}
              className="h-4 w-4 accent-orange-600"
            />
            <span>
              {unit.name}
              {!unit.isActive ? " (inactive)" : ""}
            </span>
          </label>
        ))}
      </div>
      {!available.length && (
        <p className="rounded-xl bg-white p-3 text-sm text-[#8a8780]">
          No active service groups are available in this branch yet.
        </p>
      )}
    </fieldset>
  );
}
