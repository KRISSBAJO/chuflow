import { Avatar, Badge, EmptyState, formatStatus } from "@/components/ui/ui";
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
      <EmptyState icon="clock" title="No activity yet">
        No audit entries in the current scope yet.
      </EmptyState>
    );
  }

  return (
    <ol className="relative space-y-1">
      <span aria-hidden className="absolute bottom-4 left-[17px] top-4 w-px bg-black/[0.06]" />
      {items.map((item) => (
        <li key={item._id} className="relative flex gap-3 rounded-xl py-2.5">
          <Avatar name={formatActor(item)} className="relative ring-4 ring-white" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-[1.5] text-[#111111]">{item.summary}</p>
            <p className="mt-0.5 text-[12px] text-[#8a8780]">
              {formatActor(item)}
              {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{formatStatus(item.entityType)}</Badge>
              <Badge tone="flame">{formatStatus(item.action)}</Badge>
              {item.branchId?.name ? <Badge tone="info">{item.branchId.name}</Badge> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
