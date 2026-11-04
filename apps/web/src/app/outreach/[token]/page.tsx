import { notFound } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { OutreachContactForm } from "@/components/evangelism/contact-form";
import { API_URL } from "@/lib/api";

export const metadata = {
  title: "Connect with the church | ChuFlow",
  robots: { index: false, follow: false },
};

export default async function PublicOutreachPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const response = await fetch(`${API_URL}/evangelism/public/${token}`, {
    cache: "no-store",
  });
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error(
      "The connection form is temporarily unavailable. Please try again shortly.",
    );
  const info = (await response.json()) as { branchName: string };
  return (
    <div className="app-root min-h-screen bg-[#faf9f6] px-4 py-8 sm:py-12">
      <main className="mx-auto max-w-2xl">
        <Wordmark size={26} />
        <p className="mt-8 text-sm text-[#8a8780]">{info.branchName}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Let’s stay connected.
        </h1>
        <p className="mb-7 mt-4 text-base leading-7 text-[#6b6b6b]">
          It was a pleasure connecting with you. Leave your details so our team
          can follow up, pray with you, or help you take your next step.
        </p>
        <OutreachContactForm token={token} branchName={info.branchName} />
        <p className="mt-6 text-center text-xs leading-6 text-[#8a8780]">
          Your details go to this church’s care team. You do not need a ChuFlow
          account.
        </p>
      </main>
    </div>
  );
}
