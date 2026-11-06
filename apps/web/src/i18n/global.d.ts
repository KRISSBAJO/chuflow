import type workspace from "../../messages/en/workspace.json";
import type admin from "../../messages/en/admin.json";
import type auth from "../../messages/en/auth.json";
import type common from "../../messages/en/common.json";
import type dashboard from "../../messages/en/dashboard.json";
import type landing from "../../messages/en/landing.json";
import type org from "../../messages/en/org.json";
import type people from "../../messages/en/people.json";
import type services from "../../messages/en/services.json";
import type shell from "../../messages/en/shell.json";
import type status from "../../messages/en/status.json";
import type { LOCALES } from "./config";

/* Typed message keys and locales for `useTranslations` / `getTranslations`. Keep in step with `messages.ts`. */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: typeof common &
      typeof landing &
      typeof auth &
      typeof status &
      typeof shell &
      typeof dashboard &
      typeof people &
      typeof org &
      typeof services &
      typeof admin &
      typeof workspace;
  }
}
