import { getTranslations } from "next-intl/server";
import { ParentRegistrationForm } from "@/components/children/parent-registration";
import { LanguagePicker } from "@/components/i18n/language-picker";
import "@/components/children/children.css";
export async function generateMetadata() {
  const t = await getTranslations("childrenRecords");
  return {
    title: t("parent.metaTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="children-workspace">
      <header className="children-wrap flex items-center justify-between gap-4 !pb-0">
        <span className="text-xl font-bold tracking-tight">
          ChuFlow{" "}
          <span className="rounded-xl bg-[#ffdda4] px-2 text-[#7b4c24]">Kids</span>
        </span>
        <LanguagePicker />
      </header>
      <main className="children-wrap">
        <ParentRegistrationForm token={token} />
      </main>
    </div>
  );
}
