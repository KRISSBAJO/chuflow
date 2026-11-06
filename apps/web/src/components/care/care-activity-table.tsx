"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  TableWrap,
  buttonClass,
} from "@/components/ui/ui";
import { FilterPanel } from "@/components/filter-panel";
import { careLabel, isCareLabelValue, type CareRecord } from "@/lib/care";
export function CareActivityTable({ record: c }: { record: CareRecord }) {
  const params = useSearchParams();
  const t = useTranslations("people.care.detail");
  const tc = useTranslations("people.care");
  const tw = useTranslations("workspace");
  const f = useFormatter();
  const label = (v: string) =>
    isCareLabelValue(v) ? tc(`labels.${v}`) : careLabel(v);
  const href = (page: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("page", String(page));
    q.set("tab", "timeline");
    return `/care/${c._id}?${q}`;
  };
  return (
    <Card className="p-6">
      <CardHeader title={t("activityHistory")} />
      <form action={`/care/${c._id}`} className="my-5 space-y-3">
        <input type="hidden" name="tab" value="timeline" />
        <div className="flex flex-wrap gap-3">
          <input
            className="ui-input max-w-md"
            name="search"
            aria-label={tw("search")}
            placeholder={tw("search")}
            defaultValue={params.get("search") || ""}
            maxLength={100}
          />
          <Button type="submit" variant="secondary">
            {tw("search")}
          </Button>
        </div>
        <FilterPanel>
          <div className="flex flex-wrap items-end gap-3">
            <select
              name="kind"
              aria-label={tw("activityType")}
              className="ui-input max-w-xs"
              defaultValue={params.get("kind") || ""}
            >
              <option value="">{tw("all")}</option>
              {[
                "contact",
                "note",
                "handover",
                "task",
                "complete",
                "assign",
                "pause",
                "resume",
                "enroll",
                "preferences",
              ].map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="dateFrom"
              aria-label={tw("fromDate")}
              className="ui-input max-w-xs"
              defaultValue={params.get("dateFrom") || ""}
            />
            <input
              type="date"
              name="dateTo"
              aria-label={tw("toDate")}
              className="ui-input max-w-xs"
              defaultValue={params.get("dateTo") || ""}
            />
            <Button type="submit" variant="secondary">
              {tw("apply")}
            </Button>
          </div>
        </FilterPanel>
      </form>
      <TableWrap>
        <table className="ui-table">
          <thead>
            <tr>
              <th>{tw("activityDate")}</th>
              <th>{tw("activityType")}</th>
              <th>{tw("author")}</th>
              <th>{t("method")}</th>
              <th>{t("outcome")}</th>
              <th>{tw("activityNotes")}</th>
              <th>{tw("nextAction")}</th>
            </tr>
          </thead>
          <tbody>
            {c.events.map((event) => (
              <tr key={event._id} className="align-top">
                <td className="whitespace-nowrap">
                  {f.dateTime(new Date(event.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  <Badge>{label(event.kind)}</Badge>
                  {event.visibility === "pastoral" && (
                    <span className="mt-1 block text-xs text-orange-700">
                      {t("leadershipOnly")}
                    </span>
                  )}
                </td>
                <td>
                  {event.actorId
                    ? `${event.actorId.firstName} ${event.actorId.lastName}`
                    : "—"}
                </td>
                <td>{event.data?.method ? label(event.data.method) : "—"}</td>
                <td>{event.data?.outcome ? label(event.data.outcome) : "—"}</td>
                <td className="min-w-64 max-w-md">
                  <details>
                    <summary className="cursor-pointer break-words text-sm">
                      {event.text.length > 100
                        ? event.text.slice(0, 100) + "…"
                        : event.text}
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                      {event.text}
                    </p>
                  </details>
                </td>
                <td className="whitespace-nowrap">
                  {event.data?.nextActionAt
                    ? f.dateTime(new Date(event.data.nextActionAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
            {!c.events.length && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#8a8780]">
                  {t("noActivity")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{t("entries", { count: c.eventTotal })}</span>
        <div className="flex gap-2">
          {c.eventPage > 1 && (
            <Link
              href={href(c.eventPage - 1)}
              className={buttonClass("secondary", "sm")}
            >
              {t("newer")}
            </Link>
          )}
          {c.eventPage * 20 < c.eventTotal && (
            <Link
              href={href(c.eventPage + 1)}
              className={buttonClass("secondary", "sm")}
            >
              {t("older")}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
