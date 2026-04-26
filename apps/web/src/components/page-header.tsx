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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-slate-50/80 p-10 shadow-xl border border-white/70 backdrop-blur-2xl">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(at_top_right,#f59e0b15_0%,transparent_50%)]" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {/* Content */}
        <div className="max-w-3xl space-y-4">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2">
            <div className="h-px w-6 bg-amber-500" />
            <p className="text-sm font-semibold uppercase tracking-[0.125em] text-amber-600">
              {eyebrow}
            </p>
          </div>

          {/* Title */}
          <h1 className="text-5xl lg:text-6xl font-semibold tracking-tighter leading-[1.05] text-slate-950">
            {title}
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        {/* Action Area */}
        {action && (
          <div className="shrink-0 lg:pb-2">
            <div className="flex justify-end lg:justify-start">
              {action}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}