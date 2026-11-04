import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceRequestForm } from "@/components/workspace-request-form";

export default function RequestWorkspacePage() {
  return (
    <AuthShell
      wide
      switchPrompt={{ text: "Already have a workspace?", label: "Sign in", href: "/login" }}
      aside={{
        photoId: "1778824717521-a23599f32d71",
        photoAlt: "Young church members laughing together with their Bibles",
        title: "Bring your whole church into one flow.",
        body: "Guests, members, care, attendance, finance and reports, set up for your branches, districts and national teams.",
        points: ["Guest intake", "Follow-up care", "Members", "Attendance", "Finance", "Reports"],
      }}
    >
      <WorkspaceRequestForm />
    </AuthShell>
  );
}
