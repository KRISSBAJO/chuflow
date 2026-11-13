"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge, Button, Card, Field } from "@/components/ui/ui";
import { apiGet, apiPatch } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";
import { AssetOperations } from "./asset-operations";

const transitions = {
  available: ["checked_out", "maintenance", "missing", "retired"],
  checked_out: ["available", "maintenance", "missing"],
  maintenance: ["available", "retired"],
  missing: ["available", "retired"],
  retired: [],
} as const;
type State = keyof typeof transitions;
type Movement = { state: State; at: string; actorId: string; actorEmail?: string; holder?: string; activity?: string; note?: string; fromBranchId?: string; toBranchId?: string };

export type InventoryAsset = {
  _id: string; branchId: string; tag: string; name: string; category: string;
  location?: string; serial?: string; state: State; revision: number;
  holder?: string; activity?: string; dueAt?: string; history?: Movement[];
  reservations?: { startsAt: string; endsAt: string; holder: string; activity: string; cancelledAt?: string }[];
};

function AssetRow({ item, branches, overdue }: { item: InventoryAsset; branches: BranchSummary[]; overdue: boolean }) {
  const t = useTranslations("admin.assets");
  const format = useFormatter();
  const router = useRouter();
  const [action, setAction] = useState<State>();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Movement[]>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showConflict, setShowConflict] = useState(false);

  async function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy) return;
    const data = new FormData(event.currentTarget);
    const dueAt = data.get("dueAt");
    setBusy(true);
    setShowConflict(false);
    try {
      const asset = await apiPatch<InventoryAsset>("/assets/" + item._id + "/movement", {
        state: action,
        revision: item.revision,
        holder: data.get("holder") || undefined,
        activity: data.get("activity") || undefined,
        dueAt: typeof dueAt === "string" && dueAt ? new Date(dueAt).toISOString() : undefined,
        note: data.get("note") || undefined,
      });
      setHistory(asset.history);
      setAction(undefined);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      setShowConflict(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setBusy(true);
    try {
      const asset = await apiGet<InventoryAsset>("/assets/" + item._id);
      setHistory(asset.history ?? []);
      setHistoryOpen(true);
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return <Card className="space-y-3 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">{item.name}</h2>
        <p className="text-sm text-neutral-600">{[item.tag, item.category, branches.find(branch => branch._id === item.branchId)?.name, item.location, item.serial].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={item.state === "available" ? "success" : "neutral"}>{t(`states.${item.state}`)}</Badge>
        {overdue ? <Badge tone="flame">{t("overdue")}</Badge> : null}
      </div>
    </div>
    {item.holder ? <p className="text-sm">{[item.holder, item.activity, item.dueAt && format.dateTime(new Date(item.dueAt), { dateStyle: "medium", timeStyle: "short" })].filter(Boolean).join(" · ")}</p> : null}
    <div className="flex flex-wrap gap-2">
      {transitions[item.state].map(state => <Button key={state} type="button" variant="secondary" size="sm" disabled={busy}
        aria-pressed={action === state} onClick={() => { setAction(action === state ? undefined : state); setShowConflict(false); }}>
        {t(`actions.${state}`)}
      </Button>)}
      <Button type="button" variant="secondary" size="sm" aria-expanded={historyOpen} disabled={busy}
        onClick={() => void toggleHistory()}>{t("history")}</Button>
    </div>
    {action ? <form key={action} onSubmit={move} className="space-y-3 border-t border-black/10 pt-3">
      {action === "checked_out" ? <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("holder")}><input className="ui-input" name="holder" required maxLength={120} /></Field>
        <Field label={t("activity")}><input className="ui-input" name="activity" required maxLength={160} /></Field>
        <Field label={t("dueAt")}><input className="ui-input" type="datetime-local" name="dueAt" required /></Field>
      </div> : null}
      <Field label={t("note")}><textarea className="ui-input" name="note" maxLength={500}
        required={["maintenance", "missing", "retired"].includes(action)} /></Field>
      {showConflict ? <p role="alert" className="text-sm text-red-700">{t("movementFailed")}</p> : null}
      <Button type="submit" size="sm" disabled={busy}>{t(`actions.${action}`)}</Button>
    </form> : null}
    {historyOpen ? <ol className="divide-y divide-black/10 border-t border-black/10">
      {[...(history ?? [])].reverse().map((entry, index) => <li key={entry.at + index} className="space-y-1 py-2 text-sm">
        <p className="font-medium">{t(`states.${entry.state}`)} · {format.dateTime(new Date(entry.at), { dateStyle: "medium", timeStyle: "short" })}</p>
        <p>{[entry.actorEmail ?? entry.actorId, entry.holder, entry.activity].filter(Boolean).join(" · ")}</p>
        {entry.fromBranchId && entry.toBranchId ? <p>{t("transfer")} · {branches.find(branch => branch._id === entry.fromBranchId)?.name ?? entry.fromBranchId} → {branches.find(branch => branch._id === entry.toBranchId)?.name ?? entry.toBranchId}</p> : null}
        {entry.note ? <p>{entry.note}</p> : null}
      </li>)}
    </ol> : null}
    <AssetOperations item={item} branches={branches} />
  </Card>;
}

export function AssetsWorkspace({ items, branches, tag, branchId, asOf }: {
  items: InventoryAsset[]; branches: BranchSummary[]; tag: string; branchId: string; asOf: number;
}) {
  const t = useTranslations("admin.assets");
  const tc = useTranslations("common");
  return <div className="space-y-4">
    <form key={tag + ":" + branchId} action="/assets" className="app-card grid items-end gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
      <Field label={t("tag")}><input className="ui-input" name="tag" defaultValue={tag} maxLength={64} /></Field>
      <Field label={tc("branch")}><select className="ui-input" name="branchId" defaultValue={branchId}>
        <option value="">{t("allBranches")}</option>
        {branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
      </select></Field>
      <Button type="submit" variant="secondary">{t("find")}</Button>
    </form>
    {items.length ? items.map(item => <AssetRow key={item._id + ":" + item.revision} branches={branches}
      item={{ ...item, reservations: item.reservations?.filter(row => !row.cancelledAt && new Date(row.endsAt).getTime() > asOf) }}
      overdue={Boolean(item.dueAt && new Date(item.dueAt).getTime() < asOf)}
      />) :
      <Card className="p-5">{t("empty")}</Card>}
  </div>;
}
