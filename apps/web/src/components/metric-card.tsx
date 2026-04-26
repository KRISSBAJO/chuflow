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
    <div className="group rounded-3xl bg-white/90 p-6 shadow-sm backdrop-blur-xl border border-white/60 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-[0.125em] text-slate-500">
          {label}
        </p>

        {/* Subtle Tone Indicator */}
        <div
          className={`h-2 w-2 rounded-full ${
            isWarm ? "bg-orange-500" : "bg-cyan-500"
          }`}
        />
      </div>

      {/* Value */}
      <p className="mt-4 text-4xl font-semibold tracking-tighter text-slate-900">
        {value}
      </p>

      {/* Delta */}
      <p
        className={`mt-1 text-sm font-medium ${
          isWarm ? "text-orange-600" : "text-cyan-600"
        }`}
      >
        {delta}
      </p>
    </div>
  );
}