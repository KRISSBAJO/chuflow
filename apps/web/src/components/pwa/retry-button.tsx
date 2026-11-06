"use client";

import { useTranslations } from "next-intl";

export function RetryButton() {
  const t = useTranslations("admin.pwa");
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="lp-pill-dark mt-8 inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-medium"
    >
      {t("tryAgain")}
    </button>
  );
}
