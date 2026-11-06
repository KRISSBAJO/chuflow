import Image from "next/image";
import { useTranslations } from "next-intl";

/** Illustrated hero for the Kids workspace. `children` renders under the copy (buttons, scan box). Works in server and client components. */
export function ChildrenWelcome({
  title,
  description,
  kicker,
  children,
}: {
  title?: string;
  description?: string;
  kicker?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("children.home");
  return (
    <section className="children-hero">
      <div className="children-hero-copy">
        <p className="children-kicker mb-4">{kicker ?? t("kicker")}</p>
        <h1 className="children-title">{title ?? t("title")}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#5e6b59]">
          {description ?? t("description")}
        </p>
        {children ?? (
          <div className="mt-6 flex gap-2">
            <span className="children-badge">{t("tags.welcome")}</span>
            <span className="children-badge">{t("tags.belong")}</span>
            <span className="children-badge">{t("tags.grow")}</span>
          </div>
        )}
      </div>
      <Image
        src="/children/welcome.png"
        width={1752}
        height={896}
        alt=""
        priority
      />
    </section>
  );
}
