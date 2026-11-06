"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { apiGet } from "@/lib/api";
import type { DashboardScope } from "@/lib/types";
const copy = {
  en: {
    title: "Children’s ministry",
    registered: "Registered children",
    present: "Here now",
    attended: "Child service visits",
    open: "Open children’s workspace",
    note: "Children’s roster tracked separately from the general service headcount.",
  },
  es: {
    title: "Ministerio infantil",
    registered: "Niños registrados",
    present: "Presentes ahora",
    attended: "Asistencias infantiles",
    open: "Abrir espacio infantil",
    note: "El registro infantil se lleva por separado del recuento general del servicio.",
  },
  fr: {
    title: "Ministère des enfants",
    registered: "Enfants inscrits",
    present: "Présents maintenant",
    attended: "Présences des enfants",
    open: "Ouvrir l’espace enfants",
    note: "Le registre des enfants est distinct du comptage général du culte.",
  },
  pt: {
    title: "Ministério infantil",
    registered: "Crianças registradas",
    present: "Presentes agora",
    attended: "Presenças infantis",
    open: "Abrir espaço infantil",
    note: "O registro infantil é separado da contagem geral do culto.",
  },
};
export function ChildrenDashboardSummary({ scope }: { scope: DashboardScope }) {
  const locale = useLocale(),
    t = copy[locale as keyof typeof copy] || copy.en;
  const [data, setData] = useState<{
    registered: number;
    present: number;
    attended: number;
  } | null>(null);
  const params = new URLSearchParams({ days: String(scope.days) });
  for (const key of ["branchId", "oversightRegion", "district"] as const)
    if (scope[key]) params.set(key, scope[key]!);
  const query = params.toString();
  useEffect(() => {
    let active = true;
    const load = () => {
      void apiGet<{ registered: number; present: number; attended: number }>(
        `/children/summary?${query}`,
      )
        .then((r) => {
          if (active) setData(r);
        })
        .catch(() => {
          if (active) setData(null);
        });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [query]);
  if (!data) return null;
  return (
    <section className="app-card border-l-4 border-l-[#e6ad62] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t.title}</h2>
        <Link
          href={
            scope.branchId
              ? `/children?branchId=${scope.branchId}`
              : "/children"
          }
          className="text-sm font-medium underline"
        >
          {t.open} →
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {[
          [t.registered, data.registered],
          [t.present, data.present],
          [t.attended, data.attended],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-2xl font-semibold tabular-nums">
              {Number(value).toLocaleString(locale)}
            </p>
            <p className="mt-1 text-xs text-[#6b6b6b]">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#8a8780]">{t.note}</p>
    </section>
  );
}
