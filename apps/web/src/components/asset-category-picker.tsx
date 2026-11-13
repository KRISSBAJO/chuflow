"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL, apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button, Field } from "@/components/ui/ui";
import english from "../../messages/en/common.json";

type CustomCategory = { _id: string; name: string };
const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function AssetCategoryPicker({ branchId }: { branchId: string }) {
  const t = useTranslations("common.assetCategories");
  const a = useTranslations("admin.assets");
  const [value, setValue] = useState("");
  const [data, setData] = useState<{ names: string[]; custom: CustomCategory[] }>({ names: [], custom: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const listId = useId();
  const path = "/assets/categories";
  useEffect(() => {
    if (!branchId) return;
    let active = true;
    void apiGet<typeof data>(`${path}/${branchId}`).then((result) => {
      if (active) setData(result);
    }).catch(() => { if (active) setMessage(a("failed")); });
    return () => { active = false; };
  }, [a, branchId]);
  const translated = t("defaults").split("|");
  const starter = new Map(english.common.assetCategories.defaults.split("|").map((name, index) => [translated[index], name]));
  const options = [...new Map([...starter.keys(), ...data.names.filter(name => !Array.from(starter.values()).includes(name))].map((name) => [normalize(name), name])).values()];
  const existing = options.find((name) => normalize(name) === normalize(value));

  async function change(operation: () => Promise<void>) {
    if (busy || !branchId) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setData(await apiGet<typeof data>(`${path}/${branchId}`));
      setMessage(a("saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : a("failed"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    <Field label={a("category")} hint={t("search")}>
      <input name={starter.has(existing ?? "") ? undefined : "category"} className="ui-input" value={value} required maxLength={80}
        aria-controls={listId}
        onFocus={() => setShowOptions(true)} onChange={(event) => { setValue(event.target.value); setShowOptions(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setShowOptions(false); }} />
    </Field>
    {existing && starter.has(existing) ? <input type="hidden" name="category" value={starter.get(existing)} /> : null}
    <div id={listId} hidden={!showOptions} className="max-h-48 space-y-1 overflow-auto rounded-xl border bg-white p-2">
      {options.filter((name) => !value.trim() || normalize(name).includes(normalize(value))).map((name) => (
        <button key={name} type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-100"
          onClick={() => { setValue(name); setShowOptions(false); }}>{name}</button>
      ))}
    </div>
    {value.trim() && !existing ? <Button variant="secondary" size="sm" disabled={!branchId || busy} onClick={() => void change(async () => {
      const result = await apiPost<{ name: string }>(path, { branchId, name: value });
      setValue(result.name);
      setShowOptions(false);
    })}>{t("add")}</Button> : null}
    <details className="text-sm">
      <summary className="cursor-pointer">{t("manage")}</summary>
      {data.custom.length ? <div className="mt-2 space-y-2">
        {data.custom.map((category) => <CategoryRow key={category._id + category.name} category={category} busy={busy}
          rename={(name) => void change(async () => {
            const result = await apiPatch<{ name: string }>(`${path}/${category._id}`, { branchId, name });
            if (normalize(value) === normalize(category.name)) setValue(result.name);
          })}
          remove={() => void change(async () => {
            const response = await fetch(`${API_URL}${path}/${branchId}/${category._id}`, { method: "DELETE", credentials: "include" });
            if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || a("failed"));
            if (normalize(value) === normalize(category.name)) setValue("");
          })} />)}
      </div> : <p className="mt-2">{t("empty")}</p>}
    </details>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}

function CategoryRow({ category, busy, rename, remove }: {
  category: CustomCategory; busy: boolean; rename: (name: string) => void; remove: () => void;
}) {
  const t = useTranslations("common.assetCategories");
  const [name, setName] = useState(category.name);
  return <div className="flex flex-wrap gap-2">
    <input className="ui-input min-w-32 flex-1" aria-label={t("rename")} value={name} maxLength={80}
      onChange={(event) => setName(event.target.value)} />
    <Button variant="secondary" size="sm" disabled={busy || !name.trim() || name.trim() === category.name} onClick={() => rename(name)}>{t("rename")}</Button>
    <Button variant="secondary" size="sm" disabled={busy} onClick={remove}>{t("remove")}</Button>
  </div>;
}
