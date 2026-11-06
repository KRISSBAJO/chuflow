import type { Locale } from "./config";

/*
 * Messages live in `messages/<locale>/<part>.json`, one part per feature area, so teams can
 * work on different areas without editing one giant file. Every part's top-level keys must be
 * unique across parts (they are merged shallowly). Add new parts here and in `global.d.ts`.
 */
export const MESSAGE_PARTS = [
  "common",
  "landing",
  "auth",
  "status",
  "shell",
  "dashboard",
  "people",
  "org",
  "services",
  "admin",
  "workspace",
  "imports",
  "children",
  "childrenDesk",
  "childrenRecords",
  "recording",
  "permissions",
] as const;

export type MessagePart = (typeof MESSAGE_PARTS)[number];

export async function loadMessages(locale: Locale) {
  const parts = await Promise.all(
    MESSAGE_PARTS.map(
      async (part) =>
        (await import(`../../messages/${locale}/${part}.json`))
          .default as Record<string, unknown>,
    ),
  );

  return Object.assign({}, ...parts) as Record<string, unknown>;
}
