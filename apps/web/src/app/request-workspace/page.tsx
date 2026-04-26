import Image from "next/image";
import Link from "next/link";
import { WorkspaceRequestForm } from "@/components/workspace-request-form";

export default function RequestWorkspacePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f8f6f1] via-[#f3efe6] to-white">
      <div className="absolute inset-0">
        <div className="absolute left-[-80px] top-[-100px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.06),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10 lg:px-8">
        <div className="w-full rounded-[40px] border border-black/5 bg-white/82 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.10)] backdrop-blur-xl lg:p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[26px] bg-white ring-1 ring-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <Image
                  src="/Churchflow.png"
                  alt="ChuFlow logo"
                  width={56}
                  height={56}
                  priority
                  className="h-14 w-14 object-contain"
                />
              </div>
              <h1 className="heading text-3xl font-semibold tracking-[-0.03em] text-slate-950 lg:text-4xl">
                <span>Chu</span>
                <span className="bg-gradient-to-r from-[#D4AF37] via-[#b45309] to-[#9a3412] bg-clip-text text-transparent">
                  Flow
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm"
              >
                Back home
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mb-8 max-w-2xl">
            <p className="eyebrow">Workspace Request</p>
            <h2 className="heading mt-4 text-4xl font-semibold leading-[0.98] text-slate-950 lg:text-5xl">
              Request a workspace for your church.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Share the basics below and the admin team will set up your
              workspace and first accounts.
            </p>
          </div>

          <WorkspaceRequestForm />
        </div>
      </div>
    </div>
  );
}
