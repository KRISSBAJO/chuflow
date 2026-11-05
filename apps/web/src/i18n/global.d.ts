import type en from "../../messages/en.json";
import type { LOCALES } from "./config";

/* Typed message keys and locales for `useTranslations` / `getTranslations`. */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: typeof en;
  }
}
