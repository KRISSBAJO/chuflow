import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "@/components/app/icons";

/*
 * ChuFlow app design system. Server-safe building blocks (no hooks) used by every signed-in page.
 * Colours: ink #111111, muted #6b6b6b, faint #8a8780, panel #f6f5f1, flame gradient #f59e0b → #ea580c.
 * Form controls use the `ui-input` class; tables use `ui-table` (both defined in globals.css).
 */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Layout ---------- */

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("app-card", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {label ? <p className="text-[13px] font-medium text-[#6b6b6b]">{label}</p> : null}
        <h2 className={cx("lp-heading text-[20px] leading-tight sm:text-[22px]", label && "mt-1")}>{title}</h2>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-[1.6] text-[#6b6b6b]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A labelled group inside a card, separated by a hairline. */
export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px bg-black/[0.06]", className)} />;
}

/* ---------- Buttons ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "flame";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[#111111] text-white hover:bg-[#2b2b2b]",
  secondary: "border border-black/[0.08] bg-white text-[#111111] hover:bg-[#f6f5f1]",
  ghost: "text-[#55534e] hover:bg-[#f6f5f1] hover:text-[#111111]",
  danger: "bg-red-600 text-white hover:bg-red-700",
  flame: "lp-flame-bg text-white hover:opacity-90",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-[14px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(
    "inline-flex shrink-0 items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </Link>
  );
}

/* ---------- Badges ---------- */

export type BadgeTone = "neutral" | "flame" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[#f1f0ec] text-[#3d3b37]",
  flame: "bg-orange-50 text-orange-800",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-800",
};

export function Badge({ tone = "neutral", dot = false, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium", BADGE_TONES[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

/** Maps common workflow status strings to a badge tone. */
export function statusTone(status?: string | null): BadgeTone {
  // Whole words only (underscores count as separators), negative states checked first so
  // "inactive" never matches "active".
  const words = new Set((status ?? "").toLowerCase().split(/[^a-z]+/).filter(Boolean));
  const has = (...candidates: string[]) => candidates.some((word) => words.has(word));
  if (has("rejected", "declined", "failed", "overdue", "inactive", "locked", "cancelled", "canceled", "error", "missing", "suspended", "disabled")) return "danger";
  if (has("pending", "review", "draft", "assigned", "new", "waiting", "scheduled", "progress", "submitted", "queued")) return "warning";
  if (has("approved", "active", "completed", "converted", "returned", "paid", "success", "verified", "live", "provisioned", "posted", "sent", "delivered")) return "success";
  if (has("contacted", "prayed", "invited", "returning", "info", "preview")) return "info";
  return "neutral";
}

export function formatStatus(value?: string | null) {
  if (!value) return "";
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ---------- Forms ---------- */

export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-[#111111]">
        {label}
        {required ? <span className="text-[#ea580c]"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12px] leading-[1.5] text-[#8a8780]">{hint}</span> : null}
    </label>
  );
}

/* ---------- Data display ---------- */

export function EmptyState({ icon = "sparkle", title, children, action }: { icon?: IconName; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f6f5f1] px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#8a8780] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
        <Icon name={icon} />
      </span>
      {title ? <p className="text-[15px] font-semibold text-[#111111]">{title}</p> : null}
      {children ? <p className="max-w-sm text-[14px] leading-[1.6] text-[#6b6b6b]">{children}</p> : null}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#f6f5f1] px-4 py-3.5">
      <p className="text-[12px] font-medium text-[#6b6b6b]">{label}</p>
      <p className="lp-heading mt-1 text-[22px] leading-none tabular-nums">{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-[#8a8780]">{hint}</p> : null}
    </div>
  );
}

const AVATAR_SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[12px]",
  lg: "h-11 w-11 text-[14px]",
};

export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof AVATAR_SIZES; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-[#f1f0ec] font-semibold text-[#111111]", AVATAR_SIZES[size], className)}>
      {initials}
    </span>
  );
}

/* ---------- Navigation ---------- */

/** Segmented tabs driven by links (server-friendly, state in the URL). */
export function TabLinks({ items, className }: { items: { href: string; label: string; count?: number; active: boolean }[]; className?: string }) {
  return (
    <nav aria-label="Sections" className={cx("flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#f1f0ec] p-1", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all",
            item.active ? "bg-white text-[#111111] shadow-[0_1px_3px_rgba(17,17,17,0.1)]" : "text-[#6b6b6b] hover:text-[#111111]",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span
              className={cx(
                "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                item.active && item.count > 0 ? "lp-flame-bg text-white" : "bg-black/[0.06] text-[#55534e]",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, totalPages, prevHref, nextHref }: { page: number; totalPages: number; prevHref: string; nextHref: string }) {
  if (totalPages <= 1) return null;
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  const pageButton = (disabled: boolean) =>
    cx(buttonClass("secondary", "sm"), disabled && "pointer-events-none opacity-40");

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-[13px] text-[#8a8780]">
        Page <span className="font-medium tabular-nums text-[#111111]">{page}</span> of{" "}
        <span className="tabular-nums">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Link href={prevHref} aria-disabled={atStart} tabIndex={atStart ? -1 : undefined} className={pageButton(atStart)}>
          Previous
        </Link>
        <Link href={nextHref} aria-disabled={atEnd} tabIndex={atEnd ? -1 : undefined} className={pageButton(atEnd)}>
          Next
        </Link>
      </div>
    </div>
  );
}

/** Wraps a `ui-table` so it scrolls sideways on small screens. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  // `relative` makes this the containing block, so absolutely positioned children (e.g. sr-only
  // labels in a wide table) are clipped here instead of widening the whole page on phones.
  return <div className={cx("relative -mx-1 overflow-x-auto px-1", className)}>{children}</div>;
}
