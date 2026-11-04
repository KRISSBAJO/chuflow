import Link from "next/link";

type WordmarkProps = {
  /** Font size in pixels; everything else scales from it. */
  size?: number;
  href?: string | null;
  className?: string;
};

/** The ChuFlow brand: the name itself, with a flame-coloured flow line under "Flow". */
export function Wordmark({ size = 20, href = "/", className = "" }: WordmarkProps) {
  const mark = (
    <span className={`lp-logo ${className}`} style={{ fontSize: size }}>
      Chu
      <span className="lp-logo-flow">
        Flow
        <svg viewBox="0 0 60 12" preserveAspectRatio="none" className="lp-logo-swoosh" aria-hidden>
          <defs>
            <linearGradient id="lp-logo-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <path d="M2 8 C 14 1, 24 12, 34 6 S 52 2, 58 4" pathLength={1} />
        </svg>
      </span>
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} aria-label="ChuFlow home" className="inline-flex shrink-0">
      {mark}
    </Link>
  );
}
