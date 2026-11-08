import { getTranslations } from "next-intl/server";
import { ParentRegistrationForm } from "@/components/children/parent-registration";
import { LanguagePicker } from "@/components/i18n/language-picker";
import "@/components/children/children.css";
import { notFound } from "next/navigation";
import { workspaceApiContext, workspaceId } from "@/lib/workspace-routing";
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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { token } = await params;
  const { workspace } = await searchParams;
  const scope = workspaceId(workspace);
  if (workspace && !scope) notFound();
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
        <ParentRegistrationForm token={token} apiBase={workspaceApiContext(scope).base} />
      </main>
    </div>
  );
}
