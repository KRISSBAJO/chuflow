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
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {/* Content */}
        <div className="max-w-3xl space-y-3">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2">
            <div className="h-px w-6 bg-teal-600" />
            <p className="text-sm font-semibold uppercase tracking-[0.125em] text-teal-700">
              {eyebrow}
            </p>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 lg:text-5xl">
            {title}
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-base leading-7 text-slate-600">
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
