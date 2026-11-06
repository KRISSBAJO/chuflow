"use client";
import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
const subscribe = () => () => {};
export function ChildrenLocalTime({ value }: { value: string }) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(value)),
    () => new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
  );
  return <time dateTime={value}>{text}</time>;
}
