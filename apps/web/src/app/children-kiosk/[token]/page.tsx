import { ChildrenKiosk } from "@/components/children/kiosk";
import "@/components/children/children.css";
export const metadata = {
  title: "Welcome · ChuFlow Kids",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ChildrenKiosk token={token} />;
}
