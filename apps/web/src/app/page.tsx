import { LandingPage } from "@/components/landing/landing-page";
import { getServerSessionUser } from "@/lib/auth";
import { publicServerGet } from "@/lib/server-api";
type PublicSettings = { organizationName: string; organizationTagline: string; publicConnectEnabled?: boolean };
async function getPublicSettings(): Promise<PublicSettings> {
  try {
    return await publicServerGet<PublicSettings>("/settings/public");
  } catch {
    return {
      organizationName: "ChuFlow",
      organizationTagline: "From Membership to Ministry",
      publicConnectEnabled: true,
    };
  }
}

async function getOptionalSessionUser() {
  try {
    return await getServerSessionUser();
  } catch {
    return null;
  }
}

export default async function HomePage() {
 const [settings, user] = await Promise.all([getPublicSettings(), getOptionalSessionUser()]);
 const workspaceHref = user?.role === "follow_up" ? "/follow-up" : user?.role === "usher" ? "/attendance" : "/dashboard";
 return <LandingPage tagline={settings.organizationTagline || "From membership to ministry"} signedIn={!!user} firstName={user?.firstName} workspaceHref={workspaceHref} />;
}
