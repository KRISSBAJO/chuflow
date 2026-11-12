import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";

type DeletionRequest = { firstName: string; lastName: string; email: string; requestedAt: string };

export default async function AccountDeletionRequestsPage() {
  const user = await requireServerRole("/settings");
  if (user.role !== "super_admin") notFound();

  const [requests, t, format] = await Promise.all([
    serverGet<DeletionRequest[]>("/users/account-deletion-requests"),
    getTranslations("auth.accountDeletion"),
    getFormatter(),
  ]);

  return (
    <Shell>
      <main className="mx-auto max-w-3xl space-y-5">
        <Link href="/settings" className="text-sm underline underline-offset-4">{t("back")}</Link>
        <h1 className="lp-heading text-3xl">{t("queue")}</h1>
        {requests.length ? (
          <ul className="divide-y divide-black/10 rounded-2xl border border-black/10">
            {requests.map((item) => (
              <li key={item.email} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0 break-words">
                  <p className="font-semibold">{item.firstName} {item.lastName}</p>
                  <p className="text-sm text-[var(--lp-muted)]">{item.email}</p>
                </div>
                <time dateTime={item.requestedAt} className="text-sm">
                  {format.dateTime(new Date(item.requestedAt), { dateStyle: "medium" })}
                </time>
              </li>
            ))}
          </ul>
        ) : <p>{t("empty")}</p>}
      </main>
    </Shell>
  );
}
