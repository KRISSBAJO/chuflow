export function MetricCard({
  label,
  value,
  delta,
  tone = "warm",
}: {
  label: string;
  value: string | number;
  delta: string;
  tone?: "warm" | "cool";
}) {
  return (
    <div className="app-card px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === "warm" ? "lp-flame-bg" : "bg-[#b5b2ab]"}`} />
        <p className="min-w-0 truncate text-[13px] font-medium text-[#55534e]">{label}</p>
      </div>
      <p className="mt-2.5 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[#111111]">{value}</p>
      <p className="mt-1.5 truncate text-[12px] text-[#8a8780]" title={delta}>
        {delta}
      </p>
    </div>
  );
}
