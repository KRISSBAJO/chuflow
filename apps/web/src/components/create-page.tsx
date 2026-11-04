import Link from "next/link";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { buttonClass } from "@/components/ui/ui";

export function CreatePage({ title, backHref, children }: { title: string; backHref: string; children: ReactNode }) {
  return <Shell>
    <Link href={backHref} className={buttonClass("secondary", "sm")}><Icon name="arrowLeft" /> Back</Link>
    <PageHeader eyebrow="Create" title={title} description="Complete the details below." />
    <div className="mx-auto w-full max-w-4xl space-y-6">{children}</div>
  </Shell>;
}
