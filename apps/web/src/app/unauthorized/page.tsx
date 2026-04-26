import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
      <div className="surface w-full rounded-[36px] p-10 text-center">
        <p className="eyebrow">Access Restricted</p>
        <h1 className="heading mt-4 text-5xl font-semibold text-slate-950">
          You do not have permission to view this page.
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Your account is authenticated, but this area is outside your assigned role permissions.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Switch account
          </Link>
        </div>
      </div>
    </div>
  );
}
