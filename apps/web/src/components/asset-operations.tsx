"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button, Field } from "@/components/ui/ui";
import { apiPatch, apiPost } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";
import type { InventoryAsset } from "./assets-workspace";

function BranchPicker({ branches, defaultValue }: { branches: BranchSummary[]; defaultValue?: string }) {
  const t = useTranslations("admin.assets");
  const tc = useTranslations("common");
  return <Field label={tc("branch")}><select className="ui-input" name="branchId" defaultValue={defaultValue ?? ""} required>
    <option disabled value="">{t("chooseBranch")}</option>
    {branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
  </select></Field>;
}

export function AssetOperations({ item, branches }: { item: InventoryAsset; branches: BranchSummary[] }) {
  const t = useTranslations("admin.assets");
  const format = useFormatter();
  const router = useRouter();
  const [panel, setPanel] = useState<"reserve" | "transfer" | "qr">();
  const [qr, setQr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const destinations = branches.filter(branch => branch._id !== item.branchId);
  const base = "/assets/" + item._id;

  async function showQr() {
    setPanel("qr");
    setError(false);
    try {
      const url = new URL("/assets", window.location.origin);
      url.searchParams.set("tag", item.tag);
      url.searchParams.set("assetId", item._id);
      setQr(await QRCode.toDataURL(url.href, { width: 280, margin: 2 }));
    } catch {
      setError(true);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const data = new FormData(event.currentTarget);
    try {
      if (panel === "reserve") {
        await apiPost(base + "/reservations", {
          revision: item.revision, holder: data.get("holder"), activity: data.get("activity"),
          startsAt: new Date(String(data.get("startsAt"))).toISOString(),
          endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        });
      } else {
        await apiPatch(base + "/transfer", { revision: item.revision, branchId: data.get("branchId"), location: data.get("location") });
      }
      setPanel(undefined);
      router.refresh();
    } catch {
      setError(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(startsAt: string) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await apiPatch(base + "/reservations/cancel", { revision: item.revision, startsAt });
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3 border-t border-black/10 pt-3">
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void showQr()}>{t("qrLabel")}</Button>
      {["available", "checked_out"].includes(item.state) ? <Button size="sm" variant="secondary" type="button" disabled={busy}
        onClick={() => { setPanel("reserve"); setError(false); }}>{t("reserve")}</Button> : null}
      {item.state === "available" && destinations.length ? <Button size="sm" variant="secondary" type="button" disabled={busy}
        onClick={() => { setPanel("transfer"); setError(false); }}>{t("transfer")}</Button> : null}
    </div>
    {item.reservations?.length ? <ul className="space-y-1 text-sm">
      {item.reservations.map(reservation => <li key={reservation.startsAt}>
        {reservation.holder} · {reservation.activity} · {format.dateTimeRange(new Date(reservation.startsAt), new Date(reservation.endsAt), { dateStyle: "medium", timeStyle: "short" })}
        <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void cancel(reservation.startsAt)}>{t("cancelReservation")}</Button>
      </li>)}
    </ul> : null}
    {panel === "qr" && qr ? <figure className="w-fit bg-white p-3">
      {/* The browser generates a local QR data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt={t("qrLabel") + " " + item.tag} width={140} height={140} />
      <figcaption className="text-center text-sm font-medium">{item.tag}</figcaption>
      <a className="text-sm underline" href={qr} download="chuflow-asset-qr.png">{t("downloadQr")}</a>
    </figure> : null}
    {panel === "reserve" || panel === "transfer" ? <form key={panel} className="space-y-3" onSubmit={save}>
      {panel === "reserve" ? <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("holder")}><input className="ui-input" name="holder" maxLength={120} required /></Field>
        <Field label={t("activity")}><input className="ui-input" name="activity" maxLength={160} required /></Field>
        <Field label={t("startsAt")}><input className="ui-input" name="startsAt" type="datetime-local" required /></Field>
        <Field label={t("endsAt")}><input className="ui-input" name="endsAt" type="datetime-local" required /></Field>
      </div> : <div className="grid gap-3 sm:grid-cols-2">
        <BranchPicker branches={destinations} />
        <Field label={t("location")}><input className="ui-input" name="location" maxLength={120} required /></Field>
      </div>}
      <Button size="sm" type="submit" disabled={busy}>{t(panel)}</Button>
    </form> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{t("movementFailed")}</p> : null}
  </div>;
}
