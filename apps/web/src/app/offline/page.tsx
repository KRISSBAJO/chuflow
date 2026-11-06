import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/wordmark";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata: Metadata = {
  title: "Offline · ChuFlow",
};

/** Served by the service worker when a page can't be reached. Must not depend on the API. */
export default function OfflinePage() {
  const t = useTranslations("admin.pwa");
  return (
    <main className="lp-root flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <Wordmark size={34} href={null} />
      <h1 className="lp-heading mt-10 text-[28px] leading-tight">{t("offlineTitle")}</h1>
      <p className="mt-3 max-w-[340px] text-[15px] leading-[1.6] text-[#6b6b6b]">
        {t("offlineBody")}
      </p>
      <RetryButton />
    </main>
  );
}
