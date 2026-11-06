import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, matchAcceptLanguage } from "./config";
import { loadMessages } from "./messages";

/*
 * Language is chosen per request, not per URL: the cookie set by the language picker wins,
 * otherwise the browser's Accept-Language header. Routes stay exactly as they are.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : matchAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
