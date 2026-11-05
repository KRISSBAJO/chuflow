import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceRequestForm } from "@/components/workspace-request-form";

export default async function RequestWorkspacePage() {
  const [t, tc] = await Promise.all([getTranslations("auth"), getTranslations("common")]);

  return (
    <AuthShell
      wide
      switchPrompt={{ text: t("alreadyHaveWorkspace"), label: tc("signIn"), href: "/login" }}
      aside={{
        photoId: "1778824717521-a23599f32d71",
        photoAlt: t("request.asideAlt"),
        title: t("request.asideTitle"),
        body: t("request.asideBody"),
        points: [t("request.point1"), t("request.point2"), t("request.point3"), t("request.point4"), t("request.point5"), t("request.point6")],
      }}
    >
      <WorkspaceRequestForm />
    </AuthShell>
  );
}
