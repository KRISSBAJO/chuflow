import { getTranslations } from "next-intl/server";
import { ChildrenKiosk } from "@/components/children/kiosk";
import "@/components/children/children.css";
export async function generateMetadata() {
  const t = await getTranslations("childrenDesk.kiosk");
  return {
    title: `${t("tabTitle")} · ${t("brand")} ${t("brandAccent")}`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ChildrenKiosk token={token} />;
}
