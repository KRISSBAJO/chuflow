import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { buttonClass } from "@/components/ui/ui";
import { PRIMARY_API_URL } from "@/lib/workspace-routing";

const root = "/winners-chapel/nashville";
const church = "Winners Chapel International · Nashville";
type Props = { params: Promise<{ ministry: string }> };
type KidsData = { serviceTimes: string; registrationToken: string | null };
type YouthData = { entries: { name: string; eventDate?: string; venue?: string; registrationToken: string }[] };

async function readPublicData<T>(kind: "children" | "youth"): Promise<T | null> {
  try {
    const result = await fetch(`${PRIMARY_API_URL}/${kind}-registration/nashville`, {
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    return result.ok ? await result.json() as T : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { ministry } = await params;
  if (ministry !== "kids" && ministry !== "youth") notFound();
  const t = await getTranslations("ministry");
  return {
    title: `${t(`${ministry}Title`)} | ${church}`,
    description: t(`${ministry}Intro`),
    referrer: "no-referrer" as const,
  };
}

export default async function NashvilleMinistryPage({ params }: Props) {
  const { ministry } = await params;
  if (ministry !== "kids" && ministry !== "youth") notFound();
  const kids = ministry === "kids";
  const [t, format, children, youth] = await Promise.all([
    getTranslations("ministry"),
    getFormatter(),
    kids ? readPublicData<KidsData>("children") : null,
    kids ? null : readPublicData<YouthData>("youth"),
  ]);
  const groups = youth?.entries.filter((entry) => !entry.eventDate) ?? [];
  const events = youth?.entries.filter((entry) => entry.eventDate) ?? [];

  return (
    <div className="lp-root min-h-screen bg-[#fffcf8] text-[#211a17]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" aria-label="ChuFlow"><Wordmark size={24} /></Link>
        <LanguagePicker />
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-5 pb-16 sm:px-8">
        <div className={`grid overflow-hidden rounded-[2rem] md:grid-cols-2 ${kids ? "bg-[#f8e9d8]" : "bg-[#eee6f6]"}`}>
          <div className="flex flex-col justify-center gap-5 p-7 sm:p-12">
            <p className="text-sm font-semibold text-[#654538]">{church}</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t(`${ministry}Title`)}</h1>
            <p className="max-w-md text-base leading-relaxed text-[#53453e]">{t(`${ministry}Intro`)}</p>
            <div>
              {kids && children?.registrationToken ? (
                <Link className={buttonClass("primary", "md")} href={`/children-register/${encodeURIComponent(children.registrationToken)}`}>{t("registerFamily")}</Link>
              ) : !kids ? (
                <a className={buttonClass("primary", "md")} href="#groups">{t("exploreYouth")}</a>
              ) : null}
            </div>
          </div>
          <div className="relative min-h-64 md:min-h-96">
            <Image fill priority sizes="(min-width: 768px) 50vw, 100vw" src={kids ? "/ministry/kids-welcome.webp" : "/ministry/youth-belonging.webp"} alt="" className="object-cover" />
          </div>
        </div>
        {kids ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Info title={t("serviceTimes")} body={children?.serviceTimes?.trim() || t("askServiceTimes")} />
            <Info title={t("checkIn")} body={t("checkInBody")} />
            <Info title={t("pickup")} body={t("pickupBody")} />
            {!children?.registrationToken ? <p className="text-sm text-[#53453e] sm:col-span-3">{t("askRegistration")}</p> : null}
          </div>
        ) : (
          <>
            <section id="groups" className="space-y-4">
              <h2 className="text-2xl font-bold">{t("groups")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Info title="Teens Church" body={t("teensBody")} />
                <Info title="Youth Alive Fellowship" body={t("youthAliveBody")} />
              </div>
              {groups.map((group) => (
                <Link key={group.registrationToken} className={buttonClass("secondary", "md")} href={`/youth-register/${encodeURIComponent(group.registrationToken)}`}>
                  {t("registerFor", { name: group.name })}
                </Link>
              ))}
            </section>
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">{t("events")}</h2>
              {events.length ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {events.map((event) => (
                    <li key={event.registrationToken} className="space-y-3 rounded-2xl border border-black/10 bg-white p-5">
                      <h3 className="text-lg font-semibold">{event.name}</h3>
                      <p>{[format.dateTime(new Date(event.eventDate!), { dateStyle: "medium", timeZone: "UTC" }), event.venue].filter(Boolean).join(" · ")}</p>
                      <Link className={buttonClass("primary", "sm")} href={`/youth-register/${encodeURIComponent(event.registrationToken)}`}>{t("register")}</Link>
                    </li>
                  ))}
                </ul>
              ) : <p>{t(youth ? "noEvents" : "askEvents")}</p>}
            </section>
          </>
        )}
        <footer className="border-t border-black/10 pt-5">
          <Link className="font-semibold underline underline-offset-4" href={`${root}/${kids ? "youth" : "kids"}`}>{t(kids ? "youthTitle" : "kidsTitle")}</Link>
        </footer>
      </main>
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <section className="space-y-2 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="whitespace-pre-line leading-relaxed text-[#53453e]">{body}</p>
    </section>
  );
}
