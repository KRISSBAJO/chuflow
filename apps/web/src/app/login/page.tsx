import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;

  const notice =
    params.reason === "api-unavailable"
      ? "ChuFlow API is temporarily unavailable. Please try again shortly."
      : null;

  return (
    <div className="flex min-h-screen">

      {/* ── Left: brand panel ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0c0d10] p-12 lg:flex lg:w-[44%] xl:p-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full bg-amber-500/[0.04] blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/10 ring-1 ring-white/15">
            <Image
              src="/Churchflow.png"
              alt="ChuFlow"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#0c0d10]" />
          </div>
          <div>
            <p className="heading text-[17px] font-semibold leading-none text-white">
              Chu<span className="text-amber-400">Flow</span>
            </p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.04em] text-slate-500">
              From Membership to Ministry
            </p>
          </div>
        </Link>

        {/* Middle content */}
        <div className="relative">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-500">
            Ministry Operations
          </p>
          <h2 className="heading mb-5 text-3xl font-semibold leading-tight text-white">
            Your ministry data,<br />always in reach.
          </h2>
          <p className="mb-10 text-sm leading-7 text-slate-400">
            Sign in to coordinate guests, members, attendance, and follow-up across your entire church network.
          </p>

          <div className="space-y-3.5">
            {[
              { label: "Guest capture & follow-up", dot: "bg-rose-400" },
              { label: "Member registry & records", dot: "bg-amber-400" },
              { label: "Attendance tracking", dot: "bg-cyan-400" },
              { label: "Finance & giving oversight", dot: "bg-emerald-400" },
              { label: "Multi-branch coordination", dot: "bg-indigo-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                <p className="text-sm text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative flex items-center justify-between">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} ChuFlow</p>
          <Link
            href="/request-workspace"
            className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            Need a workspace? →
          </Link>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f7f6f3] px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-950">
            <Image
              src="/Churchflow.png"
              alt="ChuFlow"
              width={24}
              height={24}
              className="h-6 w-6 object-contain brightness-0 invert"
            />
            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#f7f6f3]" />
          </div>
          <div>
            <p className="heading text-lg font-semibold text-slate-950">
              Chu<span className="text-amber-500">Flow</span>
            </p>
            <p className="text-[10px] text-slate-400">From Membership to Ministry</p>
          </div>
        </Link>

        <div className="w-full max-w-sm">
          <LoginForm notice={notice} />
        </div>
      </div>

    </div>
  );
}
