import { getTranslations } from "next-intl/server";
import type { GuestCustomAnswer } from "@/lib/guest-fields";

export async function ExtraAnswers({ answers }: { answers?: GuestCustomAnswer[] }) {
  if (!answers?.length) return null;
  const t = await getTranslations("admin.settings.guestFields");
  return (
    <section className="rounded-xl border border-black/10 p-4">
      <h2 className="mb-3 font-semibold">{t("extraAnswers")}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {answers.map(({ key, label, value }) => (
          <div key={key}><dt className="text-sm text-neutral-600">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
