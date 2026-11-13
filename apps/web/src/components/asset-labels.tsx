"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button } from "@/components/ui/ui";
import { apiGet } from "@/lib/api";

type LabelAsset = { _id: string; name: string; tag: string };

async function loadAllLabels(filters: string) {
  const query = new URLSearchParams(filters);
  const items: LabelAsset[] = [];
  const cursors = new Set<string>();
  for (;;) {
    const page = await apiGet<{ items: LabelAsset[]; next: string | null }>("/assets?" + query);
    items.push(...page.items);
    if (!page.next) return items;
    if (cursors.has(page.next)) throw new Error("Repeated inventory cursor");
    cursors.add(page.next);
    query.set("before", page.next);
  }
}

export function AssetLabels({ items, selectable = false, allFilters }: { items: LabelAsset[]; selectable?: boolean; allFilters?: string }) {
  const t = useTranslations("common.assetIntake");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  if (!items.length && allFilters === undefined) return null;
  const selected = items.filter((item) => !excluded.includes(item._id));

  async function print(all = false) {
    setError(false);
    const sheet = window.open("", "_blank");
    if (!sheet) { setError(true); return; }
    sheet.opener = null;
    setBusy(true);
    try {
      const doc = sheet.document;
      const labels = all && allFilters !== undefined ? await loadAllLabels(allFilters) : selected;
      if (!labels.length) { sheet.close(); return; }
      doc.title = t("print", { count: labels.length });
      const style = doc.createElement("style");
      style.textContent = "body{font:14px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}article{break-inside:avoid;border:1px solid #bbb;padding:8px;display:flex;align-items:center;gap:8px;overflow-wrap:anywhere}small,strong{display:block}@media print{body{margin:0}}";
      doc.head.append(style);
      const grid = doc.createElement("main");
      doc.body.append(grid);
      for (const item of labels) {
        const article = doc.createElement("article");
        grid.append(article);
        const image = doc.createElement("img");
        image.width = image.height = 84;
        image.alt = "";
        const label = doc.createElement("div");
        const name = doc.createElement("strong");
        name.textContent = item.name;
        const tag = doc.createElement("small");
        tag.textContent = item.tag;
        label.append(name, tag);
        article.append(image, label);
        const url = new URL("/assets", window.location.origin);
        url.searchParams.set("assetId", item._id);
        image.src = await QRCode.toDataURL(url.href, { margin: 2, width: 252 });
        await image.decode();
      }
      sheet.focus();
      sheet.print();
    } catch {
      sheet.close();
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={busy || !selected.length} onClick={() => void print()}>{t("print", { count: selected.length })}</Button>
      {allFilters !== undefined ? <Button variant="secondary" disabled={busy} onClick={() => void print(true)}>{t("printAll")}</Button> : null}
    </div>
    {selectable ? <details className="text-sm">
      <summary className="cursor-pointer">{t("select")}</summary>
      <div className="mt-2 grid max-h-40 gap-2 overflow-auto sm:grid-cols-2">
        {items.map((item) => <label key={item._id} className="flex gap-2">
          <input type="checkbox" checked={!excluded.includes(item._id)} onChange={(event) => {
            const checked = event.target.checked;
            setExcluded((current) => checked ? current.filter((id) => id !== item._id) : [...current, item._id]);
          }} />
          <span>{item.name} · {item.tag}</span>
        </label>)}
      </div>
    </details> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{t("printError")}</p> : null}
  </div>;
}
