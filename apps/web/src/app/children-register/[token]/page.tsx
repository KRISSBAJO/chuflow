import { ParentRegistrationForm } from "@/components/children/parent-registration";
import "@/components/children/children.css";
export const metadata = {
  title: "Family registration · ChuFlow Kids",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="children-workspace">
      <main className="children-wrap">
        <ParentRegistrationForm token={token} />
      </main>
    </div>
  );
}
