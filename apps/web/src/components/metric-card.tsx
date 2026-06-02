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
  const isWarm = tone === "warm";

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.125em] text-slate-500">
          {label}
        </p>

        {/* Subtle Tone Indicator */}
        <div
          className={`h-2 w-2 rounded-full ${
            isWarm ? "bg-amber-500" : "bg-teal-600"
          }`}
        />
      </div>

      {/* Value */}
      <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>

      {/* Delta */}
      <p
        className={`mt-1 text-sm font-medium ${
          isWarm ? "text-amber-700" : "text-teal-700"
        }`}
      >
        {delta}
      </p>
    </div>
  );
}
