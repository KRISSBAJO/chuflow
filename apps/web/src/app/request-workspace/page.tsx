import Image from "next/image";
import Link from "next/link";
import { WorkspaceRequestForm } from "@/components/workspace-request-form";

export default function RequestWorkspacePage() {
  return (
    <div className="flex min-h-screen">

      {/* ── Left: brand panel ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0c0d10] p-12 lg:flex lg:w-[42%] xl:p-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[400px] w-[400px] rounded-full bg-amber-500/[0.04] blur-3xl" />

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
            What you get
          </p>
          <h2 className="heading mb-5 text-3xl font-semibold leading-tight text-white">
            A complete operating<br />system for your church.
          </h2>
          <p className="mb-10 text-sm leading-7 text-slate-400">
            Submit your details and the admin team will provision your workspace with the right structure for your organization.
          </p>

          <div className="space-y-4">
            {[
              { label: "Guest registry & first-touch coordination", dot: "bg-rose-400", sub: "Capture every visitor" },
              { label: "Member records & service units", dot: "bg-amber-400", sub: "Full membership management" },
              { label: "Follow-up workflow engine", dot: "bg-indigo-400", sub: "Pastoral care at scale" },
              { label: "Attendance & service tracking", dot: "bg-cyan-400", sub: "Per-branch, per-service" },
              { label: "Finance & giving oversight", dot: "bg-emerald-400", sub: "Tithes, offerings, expenses" },
              { label: "National → District → Branch hierarchy", dot: "bg-orange-400", sub: "Role-scoped access" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative flex items-center justify-between">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} ChuFlow</p>
          <Link
            href="/login"
            className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            Already have one? Sign in →
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

        <div className="w-full max-w-lg">
          <h1 className="heading mb-1 text-3xl font-semibold tracking-tight text-slate-950">
            Request a workspace
          </h1>
          <p className="mb-8 text-sm leading-6 text-slate-500">
            Share your church details and we&apos;ll set up your workspace and first accounts.
          </p>
          <WorkspaceRequestForm />
        </div>
      </div>

    </div>
  );
}
