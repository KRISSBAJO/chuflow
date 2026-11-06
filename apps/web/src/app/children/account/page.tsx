import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
export default async function Page() {
  const u = await requireServerRole("/children/account");
  return (
    <>
      <Link href="/children" className="text-sm">
        ← Back to children’s workspace
      </Link>
      <section className="children-panel">
        <h1 className="text-2xl font-bold">My account</h1>
        <p className="children-muted mt-2">
          {u.firstName} {u.lastName} · {u.email}
        </p>
        <div className="mt-5 max-w-2xl">
          <ChangePasswordForm />
        </div>
      </section>
    </>
  );
}
