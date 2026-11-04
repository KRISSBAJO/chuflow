import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      switchPrompt={{ text: "New to ChuFlow?", label: "Request a workspace", href: "/request-workspace" }}
      aside={{
        photoId: "1791357775814-24088f555824",
        photoAlt: "A father lifting his child as the congregation worships",
        title: "Every member, every ministry, in one flow.",
        body: "Pick up where your team left off: guests, care, attendance and finance in one place.",
      }}
    >
      <LoginForm notice={notice} />
    </AuthShell>
  );
}
