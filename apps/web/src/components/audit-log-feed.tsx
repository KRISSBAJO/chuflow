import { useTranslations } from "next-intl";
import { Avatar, Badge, EmptyState } from "@/components/ui/ui";
import { useAppFormat, useStatusLabel } from "@/i18n/labels";
import type { AuditLogItem } from "@/lib/types";

function formatActor(item: AuditLogItem, system: string) {
  const actor = item.actor;
  if (!actor) {
    return system;
  }

  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  return name || actor.email || actor.role || system;
}

export function AuditLogFeed({ items }: { items: AuditLogItem[] }) {
  const t = useTranslations("services.audit");
  const statusLabel = useStatusLabel();
  const { dateTime } = useAppFormat();
  if (items.length === 0) {
    return (
      <EmptyState icon="clock" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <ol className="relative space-y-1">
      <span aria-hidden className="absolute bottom-4 left-[17px] top-4 w-px bg-black/[0.06]" />
      {items.map((item) => (
        <li key={item._id} className="relative flex gap-3 rounded-xl py-2.5">
          <Avatar name={formatActor(item, t("system"))} className="relative ring-4 ring-white" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-[1.5] text-[#111111]">{item.summary}</p>
            <p className="mt-0.5 text-[12px] text-[#8a8780]">
              {formatActor(item, t("system"))}
              {item.createdAt ? ` · ${dateTime(item.createdAt)}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{statusLabel(item.entityType)}</Badge>
              <Badge tone="flame">{statusLabel(item.action)}</Badge>
              {item.branchId?.name ? <Badge tone="info">{item.branchId.name}</Badge> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
