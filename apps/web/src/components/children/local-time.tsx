"use client";
import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
const subscribe = () => () => {};
const OPTIONS: Record<"datetime" | "time" | "date", Intl.DateTimeFormatOptions> =
  {
    datetime: {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    },
    time: { hour: "numeric", minute: "2-digit" },
    date: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  };
/**
 * Renders an ISO timestamp in the visitor's own time zone without a hydration
 * mismatch: the server prints UTC, the browser swaps in local time on mount.
 */
export function ChildrenLocalTime({
  value,
  format = "datetime",
}: {
  value: string;
  format?: "datetime" | "time" | "date";
}) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat(locale, OPTIONS[format]).format(new Date(value)),
    () =>
      format === "time"
        ? new Date(value).toLocaleTimeString("en-US", {
            timeZone: "UTC",
            hour: "numeric",
            minute: "2-digit",
          }) + " UTC"
        : new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
  );
  return <time dateTime={value}>{text}</time>;
}
