"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
const TONES = ["", "green", "blue", "plum"];
/** Child photo when consent allows it, otherwise a soft initial tile. */
export function ChildrenPortrait({
  url,
  name,
  size = "md",
}: {
  url?: string;
  name: string;
  size?: "md" | "lg";
}) {
  const t = useTranslations("childrenDesk.rooms");
  const px = size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11";
  if (url)
    return (
      <Image
        src={url}
        width={size === "lg" ? 64 : 44}
        height={size === "lg" ? 64 : 44}
        unoptimized
        referrerPolicy="no-referrer"
        alt={t("portrait", { name })}
        className={`${px} shrink-0 rounded-2xl object-cover`}
      />
    );
  const tone = TONES[name.length % TONES.length];
  return (
    <span aria-hidden="true" className={`kids-avatar ${tone} ${px}`}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
