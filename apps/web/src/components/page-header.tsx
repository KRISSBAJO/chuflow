import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-rise flex flex-col gap-6 pt-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="lp-label">{eyebrow}</p>
        <h1 className="lp-heading mt-3 text-[2rem] leading-[1.08] sm:text-[2.5rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#6b6b6b]">{description}</p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
