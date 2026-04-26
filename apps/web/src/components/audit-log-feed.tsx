import type { AuditLogItem } from "@/lib/types";

function formatActor(item: AuditLogItem) {
  const actor = item.actor;
  if (!actor) {
    return "System";
  }

  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  return name || actor.email || actor.role || "System";
}

export function AuditLogFeed({ items }: { items: AuditLogItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
        No audit entries in the current scope yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item._id}
          className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {item.entityType.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700">
              {item.action.replace(/_/g, " ")}
            </span>
            {item.branchId?.name ? (
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                {item.branchId.name}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{item.summary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatActor(item)}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
          </p>
        </article>
      ))}
    </div>
  );
}
