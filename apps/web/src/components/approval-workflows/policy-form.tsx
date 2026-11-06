"use client";
import { toast } from "sonner";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiPatch, apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import { approvalLevels, type ApprovalPolicy } from "@/lib/approval-workflows";
export function ApprovalPolicyForm({
  policy,
  regions,
}: {
  policy?: ApprovalPolicy;
  regions: string[];
}) {
  const t = useTranslations("admin.policyForm");
  const tr = useTranslations("admin.approvalRequests");
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const threshold = String(f.get("thresholdAmount") || "");
    const body = {
      oversightRegion: f.get("oversightRegion"),
      name: f.get("name"),
      category: f.get("category"),
      finalLevel: f.get("finalLevel"),
      currency: String(f.get("currency")).toUpperCase(),
      reviewDays: Number(f.get("reviewDays")),
      isActive: f.get("isActive") === "on",
      ...(threshold
        ? {
            thresholdAmount: Number(threshold),
            aboveThresholdLevel: f.get("aboveThresholdLevel"),
          }
        : {}),
      ...(policy ? { expectedRevision: policy.revision } : {}),
    };
    try {
      if (policy)
        await apiPatch(`/approval-workflows/policies/${policy._id}`, body);
      else await apiPost("/approval-workflows/policies", body);
      router.push("/approvals/routes?saved=1");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveError"));
      setError(e instanceof Error ? e.message : t("saveError"));
      setBusy(false);
    }
  }
  return (
    <Card className="max-w-3xl p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("nationalArea")} required>
          <input
            name="oversightRegion"
            className="ui-input"
            list="approval-regions"
            defaultValue={policy?.oversightRegion || regions[0] || ""}
            readOnly={!!policy}
            required
          />
          <datalist id="approval-regions">
            {regions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label={t("routeName")} required>
          <input
            name="name"
            className="ui-input"
            defaultValue={policy?.name}
            placeholder={t("routeNamePlaceholder")}
            minLength={2}
            maxLength={100}
            required
          />
        </Field>
        <Field label={t("category")} required>
          <input
            name="category"
            className="ui-input"
            defaultValue={policy?.category}
            placeholder={t("categoryPlaceholder")}
            minLength={2}
            maxLength={80}
            required
          />
        </Field>
        <Field label={t("finalLevel")} required>
          <select
            name="finalLevel"
            className="ui-input"
            defaultValue={policy?.finalLevel || ""}
            required
          >
            <option value="" disabled>
              {t("chooseFinal")}
            </option>
            {approvalLevels.map((l) => (
              <option key={l} value={l}>
                {t(`levels.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-[#6b6b6b]">{t("flowHelp")}</p>
        <details className="rounded-xl border border-black/10 p-4">
          <summary className="cursor-pointer font-medium">
            {t("escalationSummary")}
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("aboveAmount")}>
              <input
                name="thresholdAmount"
                type="number"
                min="0"
                step="0.01"
                max="1000000000000"
                className="ui-input"
                defaultValue={policy?.thresholdAmount}
              />
            </Field>
            <Field label={t("higherFinalLevel")}>
              <select
                name="aboveThresholdLevel"
                className="ui-input"
                defaultValue={policy?.aboveThresholdLevel || ""}
              >
                <option value="">{t("chooseHigher")}</option>
                {approvalLevels.slice(1).map((l) => (
                  <option key={l} value={l}>
                    {tr(`level.${l}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("currency")} required>
            <input
              name="currency"
              className="ui-input uppercase"
              defaultValue={policy?.currency || "USD"}
              pattern="[A-Za-z]{3}"
              maxLength={3}
              required
            />
          </Field>
          <Field label={t("reviewDays")} required>
            <input
              name="reviewDays"
              type="number"
              min={1}
              max={90}
              className="ui-input"
              defaultValue={policy?.reviewDays || 3}
              required
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={policy?.isActive ?? true}
          />
          {t("activeRoute")}
        </label>
        <p className="text-sm text-[#6b6b6b]">{t("changesNote")}</p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? t("saving") : t("save")}
        </Button>
      </form>
    </Card>
  );
}
