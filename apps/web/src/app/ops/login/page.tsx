import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OpsLoginForm } from "@/components/ops/ops-login-form";
import { getOperator } from "@/lib/ops/session";

export const metadata: Metadata = { title: "Operator console · ChuFlow", robots: { index: false, follow: false } };

export default async function OpsLoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const params = await searchParams;
  let operator: Awaited<ReturnType<typeof getOperator>> = null;
  try {
    operator = await getOperator();
  } catch {
    // The API is down: still show the form so the message comes from the sign-in attempt.
  }
  if (operator && operator !== "disabled" && params.reason !== "session") redirect("/ops");

  const notice =
    params.reason === "disabled"
      ? "The control plane is switched off on this API, so the operator console has nothing to manage."
      : params.reason === "session"
        ? "Your operator session has ended. Sign in again to continue."
        : null;

  return (
    <AuthShell
      switchPrompt={{ text: "Looking for your church?", label: "Church sign-in", href: "/login" }}
      aside={{
        photoId: "1791357775814-24088f555824",
        photoAlt: "A congregation gathered in a sunlit church",
        title: "Run every church on ChuFlow from one place.",
        body: "Provision workspaces, assign plans, record payments and keep an audit trail of every change.",
      }}
    >
      <OpsLoginForm notice={notice} />
    </AuthShell>
  );
}
