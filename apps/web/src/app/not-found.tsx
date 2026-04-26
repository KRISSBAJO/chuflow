import Image from "next/image";
import Link from "next/link";

const recoveryLinks = [
  {
    href: "/dashboard",
    label: "Open dashboard",
    tone: "primary",
  },
  {
    href: "/login",
    label: "Go to login",
    tone: "secondary",
  },
  {
    href: "/connect",
    label: "Try public connect",
    tone: "secondary",
  },
];

const commonReasons = [
  "The link was copied incorrectly or has expired.",
  "This branch, district, national area, or public form was renamed.",
  "You may be signed into the wrong account for this route.",
];

export default function NotFoundPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f8f6f1] via-[#f3efe6] to-white">
      <div className="absolute inset-0">
        <div className="absolute left-[-120px] top-[-100px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-90px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.08),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12 lg:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center">
            <div className="mb-8 inline-flex w-fit items-center gap-4 rounded-[28px] border border-black/5 bg-white/85 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-inner">
                <Image
                  src="/Churchflow.png"
                  alt="ChuFlow logo"
                  width={56}
                  height={56}
                  priority
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                  Route Recovery
                </p>
                <h1 className="heading text-2xl font-semibold leading-none text-slate-900">
                  ChuFlow
                </h1>
                <p className="text-sm text-slate-500">
                  From Membership to Ministry
                </p>
              </div>
            </div>

            <p className="eyebrow">Page Not Found</p>
            <h2 className="heading mt-5 max-w-3xl text-5xl font-semibold leading-[0.95] text-slate-900 lg:text-6xl">
              This page is not
              <br />
              where you expected
              <br />
              it to be.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
              The route may have changed, the record may no longer exist, or the
              link may belong to a different area of the system.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {commonReasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-3xl border border-black/5 bg-white/80 px-5 py-5 text-sm leading-6 text-slate-600 shadow-sm backdrop-blur-xl"
                >
                  {reason}
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-start">
            <div className="w-full max-w-xl rounded-[32px] border border-black/5 bg-white/90 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl lg:p-10">
              <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                Error 404
              </div>

              <h3 className="heading mt-5 text-4xl font-semibold leading-tight text-slate-950">
                The page, form, or structure view could not be found.
              </h3>

              <p className="mt-4 text-base leading-7 text-slate-600">
                Try a safe recovery path below. If you followed a saved or shared
                link, it may point to an older district, national area, branch,
                or public intake route.
              </p>

              <div className="mt-8 grid gap-3">
                {recoveryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      link.tone === "primary"
                        ? "rounded-2xl bg-slate-950 px-5 py-3.5 text-center text-sm font-semibold text-white"
                        : "rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-center text-sm font-semibold text-slate-700"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Quick Help
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Check whether the URL was typed or pasted correctly.</li>
                  <li>Return to the dashboard and reopen the item from the app.</li>
                  <li>Switch account if the route belongs to another role scope.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
