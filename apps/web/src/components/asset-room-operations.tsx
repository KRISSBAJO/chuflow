"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CameraScan } from "@/components/children/camera-scan";
import { Button, Card, Field, buttonClass } from "@/components/ui/ui";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";

type Item = { _id: string; name: string; tag: string; location?: string; state: "available" | "checked_out" | "maintenance" | "missing" | "retired"; kitId?: string; kitName?: string; kitCheckoutId?: string };
type Stocktake = {
  _id: string; room: string; completedAt?: string; expected: Item[];
  scans: { asset: Item; result: "present" | "misplaced" }[];
};

export function AssetRoomOperations({ mode, branches, defaultBranchId }: {
  mode: "kits" | "stocktakes"; branches: BranchSummary[]; defaultBranchId?: string;
}) {
  const t = useTranslations("common.assetOperations");
  const common = useTranslations("common");
  const [branch, setBranch] = useState(defaultBranchId ?? (branches.length === 1 ? branches[0]._id : ""));
  return <div className="mx-auto max-w-4xl space-y-4">
    <Card className="p-5">
      <Field label={common("branch")}><select className="ui-input" value={branch} onChange={(event) => setBranch(event.target.value)}>
        <option value="">—</option>
        {branches.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select></Field>
    </Card>
    {branch ? mode === "kits" ? <Kits key={branch} branch={branch} /> : <Stocktakes key={branch} branch={branch} /> : <p>{t("chooseBranch")}</p>}
  </div>;
}

async function branchItems(branch: string) {
  const items: Item[] = [];
  const query = new URLSearchParams({ branchId: branch });
  for (;;) {
    const result = await apiGet<{ items: Item[]; next: string | null }>("/assets?" + query);
    items.push(...result.items);
    if (!result.next) return items;
    query.set("before", result.next);
  }
}

function Kits({ branch }: { branch: string }) {
  const t = useTranslations("common.assetOperations");
  const a = useTranslations("admin.assets");
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void branchItems(branch).then((rows) => {
      if (active) { setItems(rows); setLoaded(true); }
    }).catch(() => { if (active) setMessage(a("failed")); });
    return () => { active = false; };
  }, [a, branch]);
  const kits = new Map<string, Item[]>();
  for (const item of items) {
    if (item.kitId) {
      const members = kits.get(item.kitId);
      if (members) members.push(item);
      else kits.set(item.kitId, [item]);
    }
  }

  async function run(operation: () => Promise<unknown>) {
    if (busy || !loaded) return;
    setBusy(true);
    setMessage("");
    try {
      await operation();
      setItems(await branchItems(branch));
      setChecked([]);
      setMessage(a("saved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : a("failed"));
    } finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => apiPost("/assets/kits", { branchId: branch, name: form.get("name"), assetIds: checked }));
  }

  function move(event: FormEvent<HTMLFormElement>, kitId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => apiPatch(`/assets/kits/${kitId}/movement`, {
      branchId: branch, state: "checked_out", holder: form.get("holder"), activity: form.get("activity"),
      dueAt: new Date(String(form.get("dueAt"))).toISOString(),
    }));
  }

  return <div className="space-y-4">
    {message ? <p role="status">{message}</p> : null}
    <Card className="space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("createKit")}</h2>
      <form className="space-y-3" onSubmit={create}>
        <Field label={t("kitName")}><input className="ui-input" name="name" maxLength={120} required /></Field>
        <Field label={a("find")}><input className="ui-input" value={filter} onChange={(event) => setFilter(event.target.value)} /></Field>
        <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">
          {items.filter((item) => !item.kitId && item.state === "available" && `${item.name} ${item.tag}`.toLowerCase().includes(filter.toLowerCase())).map((item) => (
            <label key={item._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked.includes(item._id)}
              disabled={busy || (checked.length >= 50 && !checked.includes(item._id))}
              onChange={(event) => setChecked(event.target.checked ? [...checked, item._id] : checked.filter((id) => id !== item._id))} />
              {item.name} · {item.tag}
            </label>
          ))}
        </div>
        <p className="text-sm">{t("selected", { count: checked.length })}</p>
        <Button type="submit" disabled={busy || checked.length < 2}>{t("createKit")}</Button>
      </form>
    </Card>
    {Array.from(kits, ([kitId, members]) => <Card className="space-y-3 p-5" key={kitId}>
      <h2 className="text-lg font-semibold">{members[0].kitName}</h2>
      <ul className="space-y-1 text-sm">
        {members.map((item) => <li key={item._id}>{item.name} · {item.tag} · {a(`states.${item.state}`)}</li>)}
      </ul>
      {members.some((item) => item.kitCheckoutId) ? <Button variant="secondary" disabled={busy}
        onClick={() => void run(() => apiPatch(`/assets/kits/${kitId}/movement`, { branchId: branch, state: "available" }))}>{t("returnKit")}</Button> : null}
      {members.every((item) => item.state === "available") ? <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => move(event, kitId)}>
        <Field label={a("holder")}><input className="ui-input" name="holder" maxLength={120} required /></Field>
        <Field label={a("activity")}><input className="ui-input" name="activity" maxLength={160} required /></Field>
        <Field label={a("dueAt")}><input className="ui-input" name="dueAt" type="datetime-local" required /></Field>
        <div className="sm:col-span-3"><Button type="submit" disabled={busy}>{t("checkoutKit")}</Button></div>
      </form> : null}
    </Card>)}
  </div>;
}

function Stocktakes({ branch }: { branch: string }) {
  const t = useTranslations("common.assetOperations");
  const a = useTranslations("admin.assets");
  const [records, setRecords] = useState<Pick<Stocktake, "_id" | "room" | "completedAt">[]>([]);
  const [selected, setSelected] = useState<Stocktake>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void apiGet<Pick<Stocktake, "_id" | "room" | "completedAt">[]>(`/assets/stocktakes/${branch}`).then((rows) => {
      if (active) setRecords(rows);
    }).catch(() => { if (active) setMessage(a("failed")); });
    return () => { active = false; };
  }, [a, branch]);

  async function run(operation: () => Promise<Stocktake>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await operation();
      setSelected(result);
      setRecords((rows) => [result, ...rows.filter((row) => row._id !== result._id)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : a("failed")); }
    finally { setBusy(false); }
  }

  function scan(label: string) {
    if (!selected || !label.trim()) return;
    void run(() => apiPost<Stocktake>(`/assets/stocktakes/${selected._id}/scans`, { label }));
  }

  const scanned = new Set(selected?.scans.map(({ asset }) => asset._id));
  return <div className="space-y-4">
    {message ? <p role="status">{message}</p> : null}
    <Card className="space-y-3 p-5">
      <form className="grid items-end gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
        event.preventDefault();
        const room = new FormData(event.currentTarget).get("room");
        void run(() => apiPost<Stocktake>("/assets/stocktakes", { branchId: branch, room }));
      }}>
        <Field label={t("room")}><input className="ui-input" name="room" maxLength={120} required /></Field>
        <Button type="submit" disabled={busy}>{t("start")}</Button>
      </form>
      {records.length ? <Field label={t("history")}><select className="ui-input" value={selected?._id ?? ""} disabled={busy}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) setSelected(undefined);
          else void run(() => apiGet<Stocktake>(`/assets/stocktakes/record/${id}`));
        }}>
        <option value="">—</option>
        {records.map((row) => <option key={row._id} value={row._id}>{row.room} · {t(row.completedAt ? "completed" : "inProgress")}</option>)}
      </select></Field> : null}
    </Card>
    {selected ? <Card className="space-y-4 p-5">
      <h2 className="text-lg font-semibold">{selected.room}</h2>
      {!selected.completedAt ? <>
        {!busy ? <CameraScan allowSoftwareDecoder className={buttonClass("secondary", "md")} onCode={scan} /> : null}
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          scan(String(new FormData(form).get("label")));
          form.reset();
        }}>
          <Field label={t("label")}><input className="ui-input" name="label" maxLength={512} required /></Field>
          <Button type="submit" disabled={busy}>{t("addScan")}</Button>
        </form>
      </> : <p role="status">{t("completed")}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Findings heading={t("present")} items={selected.scans.filter((row) => row.result === "present").map((row) => row.asset)} />
        <Findings heading={t("misplaced")} items={selected.scans.filter((row) => row.result === "misplaced").map((row) => row.asset)} />
        <Findings heading={t(selected.completedAt ? "missing" : "remaining")} items={selected.expected.filter((item) => !scanned.has(String(item._id)))} />
      </div>
      {!selected.completedAt ? <Button variant="secondary" disabled={busy}
        onClick={() => void run(() => apiPatch<Stocktake>(`/assets/stocktakes/${selected._id}/complete`, {}))}>{t("finish")}</Button> : null}
    </Card> : null}
  </div>;
}

function Findings({ heading, items }: { heading: string; items: Item[] }) {
  return <section className="rounded-xl bg-neutral-50 p-3">
    <h3 className="mb-2 font-semibold">{heading} · {items.length}</h3>
    <ul className="space-y-1 text-sm">{items.map((item) => <li key={item._id}>{[item.name, item.tag, item.location].filter(Boolean).join(" · ")}</li>)}</ul>
  </section>;
}
