"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
          link ? "Link changes" : "Shareable link",
        ),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Branch" required>
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
        <Field
          label="Church name shown on the public form"
          required
          hint="Shown above the form, in the permission text, and in the thank-you message."
        >
          <input
            name="churchName"
            className="ui-input"
            required
            minLength={2}
            maxLength={150}
            defaultValue={link?.churchName || (link ? link.branchId.name : "")}
            placeholder="Your church’s name"
          />
        </Field>
        <Field
          label="Link name"
          required
          hint="Use a name your team can recognize, such as Saturday outreach or My invitation link."
        >
          <input
            name="name"
            defaultValue={link?.name}
            className="ui-input"
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Field label="Link type" required>
          <select
            name="kind"
            className="ui-input"
            defaultValue={link?.kind || "personal"}
            disabled={!!link}
          >
            <option value="personal">
              My personal link — assign new contacts to me
            </option>
            <option value="branch">
              Branch link — add contacts to the shared unassigned queue
            </option>
          </select>
        </Field>

        <fieldset className="space-y-4 rounded-xl border border-black/[0.06] p-4">
          <legend className="px-2 text-sm font-medium">
            Optional form colors
          </legend>
          <p className="text-xs text-[#8a8780]">
            Leave customization off to keep the current default colors.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!headerColor}
              onChange={(event) =>
                setHeaderColor(event.target.checked ? "#111111" : "")
              }
            />{" "}
            Customize header
            <input
              type="color"
              aria-label="Header color"
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
            Customize buttons
            <input
              type="color"
              aria-label="Button color"
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
            Customize header text
            <input
              type="color"
              aria-label="Header text color"
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
            Customize button text
            <input
              type="color"
              aria-label="Button text color"
              disabled={!buttonTextColor}
              value={buttonTextColor || formTextColor(buttonColor || "#111111")}
              onChange={(event) => setButtonTextColor(event.target.value)}
            />
          </label>
          <p className="text-xs text-[#8a8780]">
            Leave text customization off for automatic readable colors. Preview
            your choices below.
          </p>
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: headerColor || "#ffffff",
              color: headerTextColor || formTextColor(headerColor || "#ffffff"),
            }}
          >
            <p className="font-semibold">Your church header</p>
          </div>
          <div
            className="inline-flex rounded-xl px-4 py-2 text-sm"
            style={{
              backgroundColor: buttonColor || "#111111",
              color: buttonTextColor || formTextColor(buttonColor || "#111111"),
            }}
          >
            Button preview
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
            Restore default colors
          </Button>
        </fieldset>
        {link && (
          <p className="text-sm text-[#6b6b6b]">
            Saving updates the existing public form. The shareable URL and QR
            code stay the same.
          </p>
        )}
        <p className="text-sm text-[#6b6b6b]">
          Anyone with the link can submit their details without signing in. They
          cannot see your contact list or private follow-up notes.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !branches.length}>
          {busy
            ? "Saving…"
            : link
              ? "Save link changes"
              : "Create shareable link"}
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/evangelism/links/${id}`, { isActive: !active });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" size="sm" disabled={busy} onClick={toggle}>
        {busy ? "Saving…" : active ? "Pause link" : "Reactivate link"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
