import Link from "next/link";
import { ChildrenAuthBoundary } from "@/components/children/auth-boundary";
import { requireServerRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { LanguagePicker } from "@/components/i18n/language-picker";
import "@/components/children/children.css";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireServerRole("/children");
  const dedicated = ["children_worker", "children_supervisor"].includes(
    user.role,
  );
  return (
    <ChildrenAuthBoundary
      userId={user._id || user.id || ""}
      role={user.role}
      scopeKey={[
        user.branchId || "",
        user.oversightRegion || "",
        user.district || "",
      ].join("|")}
    >
      <div className="children-workspace">
        <header className="border-b border-[#e5e7db] bg-white">
          <div className="children-wrap flex flex-wrap items-center justify-between gap-4 py-4">
            <Link
              href="/children"
              className="text-2xl font-bold tracking-tight"
            >
              ChuFlow{" "}
              <span className="rounded-xl bg-[#ffdda4] px-2 text-[#7b4c24]">
                Kids
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-4">
              <LanguagePicker />
              <span className="text-sm text-[#647565]">
                {user.firstName} ·{" "}
                {dedicated ? "Children’s team" : "Church leadership"}
              </span>
              {!dedicated && (
                <Link href="/dashboard" className="text-sm hover:underline">
                  Main app ↗
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="children-wrap space-y-6">
          <nav className="children-nav" aria-label="Children’s workspace">
            <Link href="/children">Welcome & sessions</Link>
            {user.role !== "children_worker" && (
              <Link href="/children/families/new">Register a family</Link>
            )}
            {user.role !== "children_worker" && (
              <Link href="/children/sessions/new">Open a session</Link>
            )}
            {user.role !== "children_worker" && (
              <Link href="/children/registrations">Parent registration</Link>
            )}
            <Link href="/children/account">My account</Link>
          </nav>
          {children}
        </main>
        <footer className="children-wrap text-center text-xs text-[#788578]">
          ChuFlow Kids · Every child known. Every handover recorded.
        </footer>
      </div>
    </ChildrenAuthBoundary>
  );
}
