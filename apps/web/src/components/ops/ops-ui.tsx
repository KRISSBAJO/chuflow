import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/ui";
import type { Access } from "@/lib/ops/types";

/* Small server-safe pieces shared by the operator console pages. */

export function OpsPageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="app-rise flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-3xl">
        {back ? (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b6b6b] hover:text-[#111111]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            </svg>
            {back.label}
          </Link>
        ) : null}
        <p className="lp-label">{eyebrow}</p>
        <h1 className="lp-heading mt-3 text-[1.9rem] leading-[1.08] sm:text-[2.3rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#6b6b6b]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

const TONES: Record<string, BadgeTone> = {
  active: "success",
  trialing: "info",
  provisioning: "warning",
  past_due: "warning",
  delinquent: "danger",
  suspended: "danger",
  cancelled: "danger",
  archived: "neutral",
  legacy: "neutral",
  full: "success",
  read_only: "warning",
  locked: "danger",
};

export function opsTone(status?: string | null): BadgeTone {
  return TONES[status ?? ""] ?? "neutral";
}

export function label(value?: string | null) {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge tone={opsTone(status)} dot>
      {label(status)}
    </Badge>
  );
}

export function AccessBadge({ access }: { access: Access }) {
  const text = access === "full" ? "Full access" : access === "read_only" ? "Read only" : "Locked";
  return <Badge tone={opsTone(access)}>{text}</Badge>;
}

const NOTICE_TONES = {
  error: "bg-red-50 text-red-800",
  success: "bg-emerald-50 text-emerald-800",
  info: "bg-amber-50 text-amber-900",
  neutral: "bg-[#f6f5f1] text-[#3d3b37]",
};

export function Notice({ tone = "info", title, children }: { tone?: keyof typeof NOTICE_TONES; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3.5 text-[14px] leading-[1.55] ${NOTICE_TONES[tone]}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[12px] font-medium text-[#8a8780]">{item.label}</dt>
          <dd className="mt-0.5 break-words text-[14px] text-[#111111]">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[12.5px]">{children}</code>;
}
