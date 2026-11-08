"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { FormFooter } from "./ops-dialogs";
import { Mono, Notice } from "./ops-ui";
import { Button, buttonClass, Card, CardHeader, Field } from "@/components/ui/ui";
import { errorMessage, opsRequest } from "@/lib/ops/client";
import { formatMoney, type Plan, type WorkspaceView } from "@/lib/ops/types";
import { SHARED_WEB_ORIGIN } from "@/lib/workspace-routing";

type Result = { workspace: WorkspaceView; adminEmail: string; adminPassword: string };

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Where the church's admin signs in: the shared web origin, or this console's own when none is set. */
function signInLink(id: string) {
  const origin = SHARED_WEB_ORIGIN ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${origin}/login?workspace=${id}`;
}

export function ProvisionForm({ plans }: { plans: Plan[] }) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const available = plans.filter((plan) => !plan.retired);

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const value = (key: string) => String(form.get(key) || "").trim();
    try {
      const created = await opsRequest<Result>("POST", "/workspaces", {
        handle: handle.trim().toLowerCase(),
        name: value("name"),
        adminEmail: value("adminEmail").toLowerCase(),
        ownerEmail: value("ownerEmail").toLowerCase() || undefined,
        region: value("region") || undefined,
        notes: value("notes") || undefined,
        planId: value("planId") || undefined,
      });
      setResult(created);
      toast.success(`${created.workspace.name} is ready.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`Workspace: ${result.workspace.id}\nSign in: ${signInLink(result.workspace.id)}\nAdmin email: ${result.adminEmail}\nTemporary password: ${result.adminPassword}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed. Select the password and copy it by hand.");
    }
  }

  if (result) {
    return (
      <Card className="p-5 sm:p-6">
        <CardHeader label="Provisioned" title={result.workspace.name} description="The first admin signs in with these credentials and should change the password immediately." />
        <div className="mt-5 space-y-4">
          <Notice tone="info" title="Shown only once">
            The password is stored sealed for the workspace worker and cannot be displayed again. Pass it to the church admin over a secure channel.
          </Notice>
          <dl className="grid gap-3 rounded-2xl bg-[#f6f5f1] p-4 text-[14px] sm:grid-cols-3">
            <div>
              <dt className="text-[12px] text-[#8a8780]">Workspace handle</dt>
              <dd className="mt-0.5"><Mono>{result.workspace.id}</Mono></dd>
            </div>
            <div>
              <dt className="text-[12px] text-[#8a8780]">Admin email</dt>
              <dd className="mt-0.5 break-all">{result.adminEmail}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[#8a8780]">Temporary password</dt>
              <dd className="mt-0.5"><Mono>{result.adminPassword}</Mono></dd>
            </div>
          </dl>
          <div className="rounded-2xl bg-[#f6f5f1] p-4 text-[14px]">
            <div className="text-[12px] text-[#8a8780]">Sign-in link</div>
            <div className="mt-0.5 break-all"><Mono>{signInLink(result.workspace.id)}</Mono></div>
            <p className="mt-2 text-[13px] text-[#8a8780]">The admin signs in here with the temporary password and is asked to choose their own before anything else.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="flame" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy credentials"}
            </Button>
            <Link href={`/ops/workspaces/${result.workspace.id}`} className={buttonClass("secondary")}>
              Open workspace
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Church name" required>
            <input
              name="name"
              className="ui-input"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!handleTouched) setHandle(slugify(event.target.value));
              }}
              placeholder="Grace Chapel Lagos"
            />
          </Field>
          <Field label="Workspace handle" required hint="Lowercase letters, numbers and hyphens. Becomes the URL and database name; it cannot change later.">
            <input
              name="handle"
              className="ui-input font-mono"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
              maxLength={64}
              value={handle}
              onChange={(event) => {
                setHandleTouched(true);
                setHandle(slugify(event.target.value));
              }}
              placeholder="grace-chapel-lagos"
            />
          </Field>
          <Field label="First admin email" required hint="Receives the only copy of the temporary password from you.">
            <input name="adminEmail" type="email" className="ui-input" required maxLength={254} placeholder="pastor@gracechapel.org" />
          </Field>
          <Field label="Owner / billing contact">
            <input name="ownerEmail" type="email" className="ui-input" maxLength={254} placeholder="Optional" />
          </Field>
          <Field label="Region">
            <input name="region" className="ui-input" maxLength={80} placeholder="Lagos, Nigeria" />
          </Field>
          <Field label="Starting plan" hint="A trial starts right away when the plan has trial days.">
            <select name="planId" className="ui-input" defaultValue={available.some((plan) => plan._id === "trial") ? "trial" : available[0]?._id}>
              {available.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} · {formatMoney(plan.priceMonthlyCents, plan.currency)}/mo{plan.trialDays ? ` · ${plan.trialDays}-day trial` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea name="notes" className="ui-input" maxLength={2000} rows={3} placeholder="Internal notes about this church" />
        </Field>
        <FormFooter busy={busy} error={error} submitLabel="Provision workspace" />
      </form>
    </Card>
  );
}
