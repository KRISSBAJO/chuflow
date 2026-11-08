"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/components/modal-shell";
import { Badge, Button, Divider, Field, TableWrap } from "@/components/ui/ui";
import { FormFooter } from "./ops-dialogs";
import { AccessBadge, KeyValue, Notice, StatusBadge, label } from "./ops-ui";
import { errorMessage, opsRequest } from "@/lib/ops/client";
import {
  dateInputValue,
  daysUntil,
  FEATURE_KEYS,
  FEATURE_LABELS,
  formatDate,
  formatMoney,
  QUOTA_KEYS,
  QUOTA_LABELS,
  SUBSCRIPTION_STATUSES,
  type EntitlementSnapshot,
  type FeatureKey,
  type Plan,
  type QuotaKey,
  type Subscription,
} from "@/lib/ops/types";

const REASONS: Record<NonNullable<EntitlementSnapshot["reason"]>, string> = {
  trial_ended: "The trial has ended and no payment was recorded.",
  payment_overdue: "The paid period ended and the grace days have run out.",
  suspended: "The subscription is suspended.",
  cancelled: "The subscription was cancelled.",
};

export function SubscriptionPanel({
  workspaceId,
  subscription,
  entitlements,
  plans,
  canEdit,
}: {
  workspaceId: string;
  subscription: Subscription | null;
  entitlements: EntitlementSnapshot;
  plans: Plan[];
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<"plan" | "payment" | null>(null);
  const plan = plans.find((item) => item._id === entitlements.planId);
  const trialDays = daysUntil(entitlements.trialEndsAt);
  const periodDays = daysUntil(entitlements.currentPeriodEnd);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[18px] font-semibold tracking-[-0.02em]">{entitlements.planName}</span>
        <StatusBadge status={entitlements.status} />
        <AccessBadge access={entitlements.access} />
        {!entitlements.enforced ? <Badge tone="neutral">Not enforced</Badge> : null}
      </div>

      {entitlements.reason && entitlements.access !== "full" ? (
        <Notice tone={entitlements.access === "locked" ? "error" : "info"}>{REASONS[entitlements.reason]}</Notice>
      ) : null}
      {!entitlements.enforced ? (
        <Notice tone="neutral">
          {subscription ? "This workspace's API has no control database configured, so nothing is enforced yet." : "No subscription exists for this workspace. Assign a plan to start enforcing features and quotas."}
        </Notice>
      ) : null}

      <KeyValue
        items={[
          { label: "Price", value: plan ? `${formatMoney(plan.priceMonthlyCents, plan.currency)} / month` : "—" },
          { label: "Billing", value: label(subscription?.billingMode ?? entitlements.billingMode ?? "manual") },
          {
            label: "Trial ends",
            value: entitlements.trialEndsAt ? `${formatDate(entitlements.trialEndsAt)}${trialDays !== null ? ` (${trialDays >= 0 ? `${trialDays} days left` : `${-trialDays} days ago`})` : ""}` : "—",
          },
          {
            label: "Paid through",
            value: entitlements.currentPeriodEnd ? `${formatDate(entitlements.currentPeriodEnd)}${periodDays !== null ? ` (${periodDays >= 0 ? `${periodDays} days left` : `${-periodDays} days ago`})` : ""}` : "—",
          },
          { label: "Grace period", value: subscription ? `${subscription.graceDays} days${entitlements.graceEndsAt ? ` · ends ${formatDate(entitlements.graceEndsAt)}` : ""}` : "—" },
          { label: "Last change", value: subscription ? formatDate(subscription.updatedAt, true) : "—" },
        ]}
      />

      <div>
        <p className="text-[12px] font-medium text-[#8a8780]">Features</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FEATURE_KEYS.map((key) => {
            const on = entitlements.features.includes(key);
            const extra = on && subscription?.overrides?.features?.includes(key) && !plan?.features.includes(key);
            return (
              <Badge key={key} tone={on ? (extra ? "flame" : "success") : "neutral"} className={on ? "" : "opacity-50 line-through"}>
                {FEATURE_LABELS[key]}
              </Badge>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-medium text-[#8a8780]">Quotas</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUOTA_KEYS.map((key) => {
            const overridden = subscription?.overrides?.quotas?.[key] !== undefined;
            return (
              <div key={key} className="rounded-xl bg-[#f6f5f1] px-3 py-2">
                <p className="text-[11px] text-[#8a8780]">{QUOTA_LABELS[key]}</p>
                <p className="text-[15px] font-semibold tabular-nums">
                  {entitlements.quotas[key] === null ? "Unlimited" : entitlements.quotas[key]}
                  {overridden ? <span className="ml-1 text-[10px] font-medium text-[#ea580c]">override</span> : null}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {subscription?.notes ? <p className="whitespace-pre-wrap rounded-2xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#3d3b37]">{subscription.notes}</p> : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog("plan")}>
            {subscription ? "Change subscription" : "Assign a plan"}
          </Button>
          {subscription ? (
            <Button variant="flame" onClick={() => setDialog("payment")}>
              Record payment
            </Button>
          ) : null}
        </div>
      ) : null}

      <Divider />
      <div>
        <p className="text-[14px] font-semibold">Payments</p>
        {subscription?.payments.length ? (
          <TableWrap className="mt-2">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Paid through</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {[...subscription.payments].reverse().map((payment) => (
                  <tr key={`${payment.at}-${payment.reference}`}>
                    <td className="whitespace-nowrap tabular-nums text-[#6b6b6b]">{formatDate(payment.at, true)}</td>
                    <td className="tabular-nums">{formatMoney(payment.amountCents, payment.currency)}</td>
                    <td>
                      {payment.reference}
                      {payment.note ? <p className="text-[12px] text-[#8a8780]">{payment.note}</p> : null}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{formatDate(payment.periodEnd)}</td>
                    <td className="text-[#6b6b6b]">{payment.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="mt-1 text-[13px] text-[#8a8780]">No payments recorded yet.</p>
        )}
      </div>

      {canEdit ? (
        <>
          <SubscriptionDialog open={dialog === "plan"} onClose={() => setDialog(null)} workspaceId={workspaceId} subscription={subscription} plans={plans} />
          {subscription ? (
            <PaymentDialog open={dialog === "payment"} onClose={() => setDialog(null)} workspaceId={workspaceId} subscription={subscription} plan={plan} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SubscriptionDialog({
  open,
  onClose,
  workspaceId,
  subscription,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  subscription: Subscription | null;
  plans: Plan[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState(subscription?.planId ?? plans.find((plan) => !plan.retired)?._id ?? "");
  const [features, setFeatures] = useState<FeatureKey[]>(subscription?.overrides?.features ?? []);
  const selected = plans.find((plan) => plan._id === planId);
  const choices = plans.filter((plan) => !plan.retired || plan._id === subscription?.planId);

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const date = (key: string) => (text(key) ? new Date(text(key) + "T23:59:59").toISOString() : null);
    const quotas: Partial<Record<QuotaKey, number>> = {};
    for (const key of QUOTA_KEYS) {
      const raw = text(`quota_${key}`);
      if (raw !== "") quotas[key] = Number(raw);
    }
    try {
      await opsRequest("PUT", `/workspaces/${workspaceId}/subscription`, {
        planId,
        status: text("status"),
        trialEndsAt: date("trialEndsAt"),
        currentPeriodEnd: date("currentPeriodEnd"),
        graceDays: Number(text("graceDays") || 0),
        overrides: { features, ...(Object.keys(quotas).length ? { quotas } : {}) },
        notes: text("notes") || undefined,
        reason: text("reason") || undefined,
      });
      toast.success("Subscription saved.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} eyebrow="Subscription" title={subscription ? "Change the subscription" : "Assign a plan"} description="Takes effect within a minute on the church's API." maxWidthClass="max-w-3xl">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" required>
            <select className="ui-input" value={planId} onChange={(event) => setPlanId(event.target.value)} required>
              {choices.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} · {formatMoney(plan.priceMonthlyCents, plan.currency)}/mo{plan.retired ? " (retired)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" required hint="Past due and read-only are computed from the dates; set them here only to force a state.">
            <select name="status" className="ui-input" defaultValue={subscription?.status ?? (selected && selected.trialDays > 0 ? "trialing" : "active")}>
              {SUBSCRIPTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trial ends" hint="Leave empty to clear; a trialing plan without a date gets its default trial length.">
            <input name="trialEndsAt" type="date" className="ui-input" defaultValue={dateInputValue(subscription?.trialEndsAt)} />
          </Field>
          <Field label="Paid through" hint="The end of the current paid period.">
            <input name="currentPeriodEnd" type="date" className="ui-input" defaultValue={dateInputValue(subscription?.currentPeriodEnd)} />
          </Field>
          <Field label="Grace days" hint="Days after the trial or period end before the workspace turns read-only.">
            <input name="graceDays" type="number" min={0} max={90} className="ui-input" defaultValue={subscription?.graceDays ?? 7} />
          </Field>
        </div>

        <div>
          <p className="text-[13px] font-medium">Extra features beyond the plan</p>
          <p className="text-[12px] text-[#8a8780]">Plan features are always on; tick anything this church should have on top.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURE_KEYS.map((key) => {
              const inPlan = selected?.features.includes(key) ?? false;
              const checked = inPlan || features.includes(key);
              return (
                <label key={key} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] ${inPlan ? "bg-emerald-50 text-emerald-900" : "bg-[#f6f5f1]"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={inPlan}
                    onChange={(event) => setFeatures((current) => (event.target.checked ? [...current, key] : current.filter((item) => item !== key)))}
                  />
                  {FEATURE_LABELS[key]}
                  {inPlan ? <span className="ml-auto text-[10px] uppercase tracking-wide">plan</span> : null}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-medium">Quota overrides</p>
          <p className="text-[12px] text-[#8a8780]">Empty keeps the plan limit. Enter a number to replace it for this church only.</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUOTA_KEYS.map((key) => (
              <Field key={key} label={QUOTA_LABELS[key]} hint={selected ? `Plan: ${selected.quotas[key] ?? "unlimited"}` : undefined}>
                <input name={`quota_${key}`} type="number" min={0} className="ui-input" defaultValue={subscription?.overrides?.quotas?.[key] ?? ""} placeholder="plan" />
              </Field>
            ))}
          </div>
        </div>

        <Field label="Internal notes">
          <textarea name="notes" className="ui-input" rows={2} maxLength={2000} defaultValue={subscription?.notes ?? ""} />
        </Field>
        <Field label="Reason for this change" hint="Kept in the audit log.">
          <input name="reason" className="ui-input" maxLength={500} placeholder="e.g. Upgraded after the pastor's call on Monday" />
        </Field>
        <FormFooter busy={busy} error={error} onCancel={onClose} submitLabel="Save subscription" />
      </form>
    </ModalShell>
  );
}

function PaymentDialog({ open, onClose, workspaceId, subscription, plan }: { open: boolean; onClose: () => void; workspaceId: string; subscription: Subscription; plan?: Plan }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One month after the current paid period (or today, when it already ended).
  const [suggested] = useState(() => {
    const now = new Date();
    const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
    const base = end && end.getTime() > now.getTime() ? end : now;
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1);
    return next;
  });

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    try {
      await opsRequest("POST", `/workspaces/${workspaceId}/payments`, {
        amountCents: Math.round(Number(text("amount") || 0) * 100),
        currency: text("currency").toUpperCase(),
        reference: text("reference"),
        periodEnd: new Date(text("periodEnd") + "T23:59:59").toISOString(),
        note: text("note") || undefined,
      });
      toast.success("Payment recorded; the workspace is active.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} eyebrow="Billing" title="Record a payment" description="For money received outside the app (transfer, cheque, cash). Extends the paid period and reactivates the workspace." maxWidthClass="max-w-xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" required>
            <input name="amount" type="number" step="0.01" min={0} className="ui-input" required defaultValue={plan ? (plan.priceMonthlyCents / 100).toFixed(2) : ""} />
          </Field>
          <Field label="Currency" required>
            <input name="currency" className="ui-input uppercase" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={plan?.currency ?? "USD"} />
          </Field>
          <Field label="Reference" required hint="Transfer ID, receipt number or similar.">
            <input name="reference" className="ui-input" required maxLength={120} />
          </Field>
          <Field label="Paid through" required hint="The new end of the paid period.">
            <input name="periodEnd" type="date" className="ui-input" required defaultValue={suggested.toISOString().slice(0, 10)} />
          </Field>
        </div>
        <Field label="Note">
          <input name="note" className="ui-input" maxLength={500} />
        </Field>
        <FormFooter busy={busy} error={error} onCancel={onClose} submitLabel="Record payment" />
      </form>
    </ModalShell>
  );
}
