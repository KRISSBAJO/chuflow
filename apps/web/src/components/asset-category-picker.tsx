"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL, apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/ui";
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
  const [query, setQuery] = useState("");
  const [manage, setManage] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
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
  const matches = (name: string) => normalize(query).split(" ").every((word) => normalize(name).includes(word));
  const visible = options.filter(matches);
  const custom = data.custom.filter((category) => matches(category.name));
  const existing = options.some((name) => normalize(name) === normalize(query));
  const common = useTranslations("common");

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
    <p id={listId} className="text-sm font-medium">{a("category")}</p>
    <input type="hidden" name="category" value={starter.get(value) ?? value} />
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-labelledby={`${listId} ${listId}-value`}
      className="ui-input flex w-full items-center justify-between gap-2 text-left"
      onClick={() => {
        setQuery("");
        setManage(false);
        setMessage("");
        dialog.current?.showModal();
        search.current?.focus();
      }}>
      <span id={`${listId}-value`} className="min-w-0 truncate">{value || t("search")}</span>
      <span aria-hidden="true">⌄</span>
    </button>
    <dialog ref={dialog} aria-labelledby={`${listId}-title`} onClose={() => trigger.current?.focus()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/35"
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      }}>
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 id={`${listId}-title`} className="text-lg font-semibold">{manage ? t("manage") : a("category")}</h2>
      <Button variant="secondary" size="sm" onClick={() => dialog.current?.close()}>{common("close")}</Button>
    </div>
    <input ref={search} className="ui-input w-full" type="search" value={query} maxLength={80}
      aria-label={t("search")} placeholder={t("search")} onChange={(event) => setQuery(event.target.value)} />
    {!manage ? <div className="my-3 max-h-[40vh] space-y-1 overflow-auto">
      {visible.slice(0, 20).map((name) => (
        <button key={name} type="button" aria-pressed={value === name}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 aria-pressed:bg-neutral-100"
          onClick={() => { setValue(name); dialog.current?.close(); }}>{name}</button>
      ))}
      {visible.length > 20 ? <p className="px-3 py-2 text-sm text-neutral-600">{t("refine")}</p> : null}
      {!visible.length ? <p className="px-3 py-2 text-sm text-neutral-600">{t("noMatches")}</p> : null}
    </div> : null}
    {!manage && query.trim() && !existing ? <Button variant="secondary" size="sm" disabled={!branchId || busy} onClick={() => void change(async () => {
      const result = await apiPost<{ name: string }>(path, { branchId, name: query });
      setValue(result.name);
      dialog.current?.close();
    })}>{t("add")}</Button> : null}
    {manage ? <div className="my-3 max-h-[40vh] space-y-2 overflow-auto">
        {custom.slice(0, 20).map((category) => <CategoryRow key={category._id + category.name} category={category} busy={busy}
          rename={(name) => void change(async () => {
            const result = await apiPatch<{ name: string }>(`${path}/${category._id}`, { branchId, name });
            if (normalize(value) === normalize(category.name)) setValue(result.name);
          })}
          remove={() => void change(async () => {
            const response = await fetch(`${API_URL}${path}/${branchId}/${category._id}`, { method: "DELETE", credentials: "include" });
            if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || a("failed"));
            if (normalize(value) === normalize(category.name)) setValue("");
          })} />)}
      {custom.length > 20 ? <p className="text-sm">{t("refine")}</p> : null}
      {!custom.length ? <p className="text-sm">{t(query.trim() ? "noMatches" : "empty")}</p> : null}
    </div> : null}
    <div className="mt-3">
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setManage(!manage); setQuery(""); search.current?.focus(); }}>
        {manage ? common("back") : t("manage")}
      </Button>
    </div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    </dialog>
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
