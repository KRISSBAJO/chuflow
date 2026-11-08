"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/components/modal-shell";
import { Badge, Button, Card, CardHeader, Field } from "@/components/ui/ui";
import { FormFooter } from "./ops-dialogs";
import { errorMessage, opsRequest } from "@/lib/ops/client";
import { FEATURE_KEYS, FEATURE_LABELS, formatMoney, QUOTA_KEYS, QUOTA_LABELS, type FeatureKey, type Plan, type QuotaKey } from "@/lib/ops/types";

export function PlanEditor({ plans, canEdit }: { plans: Plan[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  return (
    <>
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="flame" icon="plus" onClick={() => setEditing("new")}>
            New plan
          </Button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan._id} className={`p-5 sm:p-6 ${plan.retired ? "opacity-70" : ""}`}>
            <CardHeader
              label={plan._id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {plan.name}
                  {plan.retired ? <Badge tone="neutral">Retired</Badge> : null}
                </span>
              }
              description={plan.description}
              action={
                canEdit ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(plan)}>
                    Edit
                  </Button>
                ) : undefined
              }
            />
            <p className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {formatMoney(plan.priceMonthlyCents, plan.currency)}
              <span className="text-[13px] font-normal text-[#8a8780]"> / month</span>
            </p>
            <p className="mt-1 text-[12px] text-[#8a8780]">{plan.trialDays ? `${plan.trialDays}-day trial` : "No trial"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUOTA_KEYS.map((key) => (
                <div key={key} className="rounded-xl bg-[#f6f5f1] px-3 py-2">
                  <p className="text-[11px] text-[#8a8780]">{QUOTA_LABELS[key]}</p>
                  <p className="text-[14px] font-semibold tabular-nums">{plan.quotas[key] === null ? "∞" : plan.quotas[key]}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {FEATURE_KEYS.map((key) => (
                <Badge key={key} tone={plan.features.includes(key) ? "success" : "neutral"} className={plan.features.includes(key) ? "" : "opacity-50 line-through"}>
                  {FEATURE_LABELS[key]}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {canEdit ? <PlanDialog key={editing === "new" ? "new" : (editing?._id ?? "closed")} plan={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function PlanDialog({ plan, open, onClose }: { plan: Plan | null; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureKey[]>(plan?.features ?? [...FEATURE_KEYS]);

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const id = plan?._id ?? text("id").toLowerCase();
    const quotas: Partial<Record<QuotaKey, number | null>> = {};
    for (const key of QUOTA_KEYS) {
      const raw = text(`quota_${key}`);
      quotas[key] = raw === "" ? null : Number(raw);
    }
    try {
      await opsRequest("PUT", `/plans/${encodeURIComponent(id)}`, {
        name: text("name"),
        description: text("description") || undefined,
        features,
        quotas,
        priceMonthlyCents: Math.round(Number(text("price") || 0) * 100),
        currency: text("currency").toUpperCase(),
        trialDays: Number(text("trialDays") || 0),
        retired: form.get("retired") === "on",
      });
      toast.success(plan ? "Plan saved." : "Plan created.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} eyebrow="Plans" title={plan ? `Edit ${plan.name}` : "New plan"} description="Changes apply to every workspace on this plan the next time its API refreshes entitlements." maxWidthClass="max-w-2xl">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {plan ? null : (
            <Field label="Plan ID" required hint="Lowercase letters, numbers, hyphens or underscores. Cannot change later.">
              <input name="id" className="ui-input font-mono" required pattern="[a-z0-9_-]{1,40}" maxLength={40} placeholder="growth" />
            </Field>
          )}
          <Field label="Name" required>
            <input name="name" className="ui-input" required maxLength={80} defaultValue={plan?.name ?? ""} />
          </Field>
          <Field label="Monthly price" required>
            <input name="price" type="number" step="0.01" min={0} className="ui-input" required defaultValue={plan ? (plan.priceMonthlyCents / 100).toFixed(2) : "0.00"} />
          </Field>
          <Field label="Currency" required>
            <input name="currency" className="ui-input uppercase" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={plan?.currency ?? "USD"} />
          </Field>
          <Field label="Trial days" required>
            <input name="trialDays" type="number" min={0} max={365} className="ui-input" required defaultValue={plan?.trialDays ?? 0} />
          </Field>
        </div>
        <Field label="Description">
          <input name="description" className="ui-input" maxLength={300} defaultValue={plan?.description ?? ""} />
        </Field>
        <div>
          <p className="text-[13px] font-medium">Features</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-xl bg-[#f6f5f1] px-3 py-2 text-[13px]">
                <input type="checkbox" checked={features.includes(key)} onChange={(event) => setFeatures((current) => (event.target.checked ? [...current, key] : current.filter((item) => item !== key)))} />
                {FEATURE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-medium">Quotas</p>
          <p className="text-[12px] text-[#8a8780]">Leave a field empty for unlimited.</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUOTA_KEYS.map((key) => (
              <Field key={key} label={QUOTA_LABELS[key]}>
                <input name={`quota_${key}`} type="number" min={0} className="ui-input" defaultValue={plan?.quotas[key] ?? ""} placeholder="∞" />
              </Field>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="retired" defaultChecked={plan?.retired ?? false} />
          Retired: cannot be assigned to new workspaces; existing subscriptions keep it.
        </label>
        <FormFooter busy={busy} error={error} onCancel={onClose} submitLabel={plan ? "Save plan" : "Create plan"} />
      </form>
    </ModalShell>
  );
}
