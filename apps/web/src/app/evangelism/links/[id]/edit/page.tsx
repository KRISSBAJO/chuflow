import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { buttonClass } from "@/components/ui/ui";
import { OutreachLinkForm } from "@/components/evangelism/link-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { OutreachLink } from "@/lib/evangelism";

export default async function EditOutreachLink({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/evangelism");
  const { id } = await params;
  const link = await serverGet<OutreachLink>(`/evangelism/links/${id}`);
  return (
    <Shell>
      <Link href="/evangelism/links" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> Back to shareable links
      </Link>
      <PageHeader
        eyebrow="Evangelism"
        title="Edit shareable link"
        description="Update the church name and internal link label without changing the URL or QR code."
      />
      <div className="mx-auto w-full max-w-3xl">
        <OutreachLinkForm branches={[link.branchId]} link={link} />
      </div>
    </Shell>
  );
}
