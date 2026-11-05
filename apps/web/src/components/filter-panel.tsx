import type { ReactNode } from "react";
import { Icon } from "@/components/app/icons";

export function FilterPanel({ children, title = "Filters", className = "my-4 p-4" }: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <details className={`app-card group/filters ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><Icon name="filter" className="h-4 w-4 text-[#df6d13]" />{title}</span>
        <span className="flex items-center gap-2 text-xs text-[#8a8780]"><span className="group-open/filters:hidden">Show</span><span className="hidden group-open/filters:inline">Hide</span><Icon name="chevronDown" className="h-4 w-4 transition-transform group-open/filters:rotate-180" /></span>
      </summary>
      <div className="mt-4 border-t border-black/5 pt-4">{children}</div>
    </details>
  );
}
