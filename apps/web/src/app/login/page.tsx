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
      ? "Backend API is not reachable. Run `npm run dev:api`."
      : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8f6f1]">
      {/* subtle background */}
      <div className="absolute inset-0">
        <div className="absolute top-[-120px] left-[-80px] h-[400px] w-[400px] rounded-full bg-[#D4AF37]/10 blur-2xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[400px] w-[400px] rounded-full bg-black/5 blur-2xl" />
      </div>

      {/* centered layout */}
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">

          {/* logo (clickable) */}
          <Link href="/" className="mb-8 block text-center group">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow transition group-hover:shadow-md">
                <Image
                  src="/Churchflow.png"
                  alt="ChuFlow logo"
                  width={40}
                  height={40}
                  priority
                  className="object-contain"
                />
              </div>

              <h1 className="text-2xl font-semibold text-slate-900 group-hover:opacity-80 transition">
                <span className="text-slate-950">Chu</span>
                <span className="text-amber-700">Flow</span>
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                From Membership to Ministry
              </p>
            </div>
          </Link>

          {/* login form */}
          <LoginForm notice={notice} />

          {/* footer */}
          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} ChuFlow
          </p>
        </div>
      </div>
    </div>
  );
}
