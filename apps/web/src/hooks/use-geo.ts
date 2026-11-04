"use client";

import { useMemo, useSyncExternalStore } from "react";
import { UNITED_STATES_PROFILE, type GeoCountryProfile } from "@/lib/geo";

function getInitialLocale() {
  if (typeof navigator === "undefined") {
    return "en-US";
  }

  return navigator.language || "en-US";
}

function getInitialTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

function getRegionCode(locale: string) {
  const localeParts = locale.split(/[-_]/);
  return localeParts[1]?.toUpperCase() || UNITED_STATES_PROFILE.code;
}

// The browser locale/time zone never change while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => {};
const getServerLocale = () => "en-US";
const getServerTimeZone = () => "America/Chicago";

export function useGeo() {
  const locale = useSyncExternalStore(subscribe, getInitialLocale, getServerLocale);
  const timeZone = useSyncExternalStore(subscribe, getInitialTimeZone, getServerTimeZone);

  return useMemo(
    () => ({
      locale,
      timeZone,
      detectedRegionCode: getRegionCode(locale),
      isUnitedStates:
        getRegionCode(locale) === UNITED_STATES_PROFILE.code ||
        timeZone.startsWith("America/"),
      country: UNITED_STATES_PROFILE satisfies GeoCountryProfile,
      states: UNITED_STATES_PROFILE.states,
      currency: UNITED_STATES_PROFILE.currency,
    }),
    [locale, timeZone],
  );
}
