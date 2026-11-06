"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { SessionTrendPoint } from "@/lib/children";

const W = 640;
const H = 220;
const PAD = { top: 24, right: 12, bottom: 34, left: 32 };

/** Single-series bar chart of unique children per session with a hover tooltip and a table view. */
export function TrendChart({ points }: { points: SessionTrendPoint[] }) {
  const t = useTranslations("children.home.trend");
  const format = useFormatter();
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="kids-empty">
        <span className="kids-empty-icon" aria-hidden>
          📈
        </span>
        <p>{t("empty")}</p>
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.attended));
  const total = points.reduce((sum, p) => sum + p.attended, 0);
  const average = Math.round(total / points.length);
  const best = Math.max(...points.map((p) => p.attended));
  const latest = points[points.length - 1];
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const barW = Math.min(44, slot * 0.62);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;
  const ticks = [0, Math.round(max / 2), max];
  const day = (value: string) =>
    format.dateTime(new Date(value), { month: "short", day: "numeric" });
  const active = hover === null ? null : points[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <span className="children-badge">
          {t("latest", { value: format.number(latest.attended) })}
        </span>
        <span className="children-badge neutral">
          {t("average", { value: format.number(average) })}
        </span>
        <span className="children-badge amber">
          {t("best", { value: format.number(best) })}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="kids-chart"
          role="img"
          aria-labelledby={`${id}-title`}
          onMouseLeave={() => setHover(null)}
        >
          <title id={`${id}-title`}>{t("title")}</title>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#eceee4"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 3}
                textAnchor="end"
                className="tick"
              >
                {tick}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = PAD.left + slot * index + (slot - barW) / 2;
            const top = y(point.attended);
            const height = Math.max(0, PAD.top + innerH - top);
            const isLatest = index === points.length - 1;
            const isBest = point.attended === best && best > 0;
            return (
              <g key={point._id}>
                <rect
                  x={PAD.left + slot * index}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={t("tooltip", {
                    name: point.name,
                    date: day(point.startsAt),
                    count: point.attended,
                  })}
                />
                <rect
                  x={x}
                  y={top}
                  width={barW}
                  height={height}
                  rx={4}
                  className={`bar${isLatest || hover === index ? " now" : ""}`}
                  pointerEvents="none"
                />
                {(isLatest || isBest) && point.attended > 0 && (
                  <text
                    x={x + barW / 2}
                    y={top - 6}
                    textAnchor="middle"
                    className="value"
                  >
                    {point.attended}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={H - 12}
                  textAnchor="middle"
                  className="tick"
                >
                  {day(point.startsAt)}
                </text>
              </g>
            );
          })}
        </svg>
        {active && (
          <div
            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-xl border border-[#e6e8dd] bg-white px-3 py-2 text-xs shadow-lg"
            role="status"
          >
            {t("tooltip", {
              name: active.name,
              date: day(active.startsAt),
              count: active.attended,
            })}
          </div>
        )}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#426653]">
          {t("table")}
        </summary>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#8a9589]">
              <th className="py-1 pr-3 font-semibold">{t("session")}</th>
              <th className="py-1 pr-3 font-semibold">{t("date")}</th>
              <th className="py-1 pr-3 text-right font-semibold">
                {t("attended")}
              </th>
              <th className="py-1 text-right font-semibold">{t("capacity")}</th>
            </tr>
          </thead>
          <tbody>
            {points
              .slice()
              .reverse()
              .map((point) => (
                <tr key={point._id} className="border-t border-[#eef0e6]">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/children/sessions/${point._id}`}
                      className="font-medium hover:underline"
                    >
                      {point.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-[#65746a]">
                    {day(point.startsAt)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {format.number(point.attended)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[#65746a]">
                    {format.number(point.capacity)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
