"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiPost, apiPatch } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";
import type { OutreachLink } from "@/lib/evangelism";
import { formTextColor } from "@/lib/form-colors";
import { createdHref } from "@/lib/directory";

export function OutreachLinkForm({
  branches,
  defaultBranchId,
  link,
}: {
  branches: Pick<BranchSummary, "_id" | "name">[];
  defaultBranchId?: string;
  link?: OutreachLink;
}) {
  const router = useRouter();
  const t = useTranslations("people.evangelism.linkForm");
  const tc = useTranslations("common");
  const tsh = useTranslations("people.shared");
  const [headerTextColor, setHeaderTextColor] = useState(
    link?.headerTextColor || "",
  );
  const [buttonTextColor, setButtonTextColor] = useState(
    link?.buttonTextColor || "",
  );
  const [headerColor, setHeaderColor] = useState(link?.headerColor || "");
  const [buttonColor, setButtonColor] = useState(link?.buttonColor || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: data.get("name"),
        churchName: data.get("churchName"),
        headerTextColor: headerTextColor || null,
        buttonTextColor: buttonTextColor || null,
        headerColor: headerColor || null,
        buttonColor: buttonColor || null,
      };
      const result = link
        ? await apiPatch(`/evangelism/links/${link._id}`, payload)
        : await apiPost("/evangelism/links", {
            ...payload,
            branchId: data.get("branchId"),
            kind: data.get("kind"),
          });
      router.push(
        createdHref(
          "/evangelism/links",
          result,
          link ? t("entityChanges") : t("entityLink"),
        ),
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorCreate"));
      setError(e instanceof Error ? e.message : t("errorCreate"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label={tc("branch")} required>
          <select
            name="branchId"
            className="ui-input"
            required
            defaultValue={
              link?.branchId._id || defaultBranchId || branches[0]?._id
            }
            disabled={!!link}
          >
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("churchName")} required hint={t("churchNameHint")}>
          <input
            name="churchName"
            className="ui-input"
            required
            minLength={2}
            maxLength={150}
            defaultValue={link?.churchName || (link ? link.branchId.name : "")}
            placeholder={t("churchNamePlaceholder")}
          />
        </Field>
        <Field label={t("linkName")} required hint={t("linkNameHint")}>
          <input
            name="name"
            defaultValue={link?.name}
            className="ui-input"
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Field label={t("linkType")} required>
          <select
            name="kind"
            className="ui-input"
            defaultValue={link?.kind || "personal"}
            disabled={!!link}
          >
            <option value="personal">{t("personal")}</option>
            <option value="branch">{t("branchKind")}</option>
          </select>
        </Field>

        <fieldset className="space-y-4 rounded-xl border border-black/[0.06] p-4">
          <legend className="px-2 text-sm font-medium">{t("colors")}</legend>
          <p className="text-xs text-[#8a8780]">{t("colorsHint")}</p>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!headerColor}
              onChange={(event) =>
                setHeaderColor(event.target.checked ? "#111111" : "")
              }
            />{" "}
            {t("customizeHeader")}
            <input
              type="color"
              aria-label={t("headerColor")}
              disabled={!headerColor}
              value={headerColor || "#ffffff"}
              onChange={(event) => setHeaderColor(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!buttonColor}
              onChange={(event) =>
                setButtonColor(event.target.checked ? "#111111" : "")
              }
            />{" "}
            {t("customizeButtons")}
            <input
              type="color"
              aria-label={t("buttonColor")}
              disabled={!buttonColor}
              value={buttonColor || "#111111"}
              onChange={(event) => setButtonColor(event.target.value)}
            />
          </label>

          <label className="flex flex-wrap items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!headerTextColor}
              onChange={(event) =>
                setHeaderTextColor(
                  event.target.checked
                    ? formTextColor(headerColor || "#ffffff")
                    : "",
                )
              }
            />{" "}
            {t("customizeHeaderText")}
            <input
              type="color"
              aria-label={t("headerTextColor")}
              disabled={!headerTextColor}
              value={headerTextColor || formTextColor(headerColor || "#ffffff")}
              onChange={(event) => setHeaderTextColor(event.target.value)}
            />
          </label>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!buttonTextColor}
              onChange={(event) =>
                setButtonTextColor(
                  event.target.checked
                    ? formTextColor(buttonColor || "#111111")
                    : "",
                )
              }
            />{" "}
            {t("customizeButtonText")}
            <input
              type="color"
              aria-label={t("buttonTextColor")}
              disabled={!buttonTextColor}
              value={buttonTextColor || formTextColor(buttonColor || "#111111")}
              onChange={(event) => setButtonTextColor(event.target.value)}
            />
          </label>
          <p className="text-xs text-[#8a8780]">{t("textHint")}</p>
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: headerColor || "#ffffff",
              color: headerTextColor || formTextColor(headerColor || "#ffffff"),
            }}
          >
            <p className="font-semibold">{t("headerPreview")}</p>
          </div>
          <div
            className="inline-flex rounded-xl px-4 py-2 text-sm"
            style={{
              backgroundColor: buttonColor || "#111111",
              color: buttonTextColor || formTextColor(buttonColor || "#111111"),
            }}
          >
            {t("buttonPreview")}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setHeaderTextColor("");
              setButtonTextColor("");
              setHeaderColor("");
              setButtonColor("");
            }}
          >
            {t("restoreColors")}
          </Button>
        </fieldset>
        {link && <p className="text-sm text-[#6b6b6b]">{t("savingNote")}</p>}
        <p className="text-sm text-[#6b6b6b]">{t("anyoneNote")}</p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !branches.length}>
          {busy ? tsh("savingEllipsis") : link ? t("saveChanges") : t("create")}
        </Button>
      </form>
    </Card>
  );
}

export function OutreachLinkToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const actionToast = useActionToast();

  const router = useRouter();
  const t = useTranslations("people.evangelism.linkForm");
  const tsh = useTranslations("people.shared");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/evangelism/links/${id}`, { isActive: !active });
      router.refresh();

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorChange"));
      setError(e instanceof Error ? e.message : t("errorChange"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" size="sm" disabled={busy} onClick={toggle}>
        {busy ? tsh("savingEllipsis") : active ? t("pause") : t("reactivate")}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
