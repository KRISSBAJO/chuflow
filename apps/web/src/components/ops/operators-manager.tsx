"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/components/modal-shell";
import { Badge, Button, Card, Field, TableWrap } from "@/components/ui/ui";
import { FormFooter } from "./ops-dialogs";
import { Notice } from "./ops-ui";
import { errorMessage, opsRequest } from "@/lib/ops/client";
import { formatDate, OPERATOR_ROLE_LABELS, OPERATOR_ROLES, type OperatorRole, type OperatorView } from "@/lib/ops/types";

const ROLE_HELP: Record<OperatorRole, string> = {
  owner: "Everything, including operators and archiving.",
  support: "Provision, edit, suspend and reactivate workspaces.",
  billing: "Plans, subscriptions, payments, suspend and reactivate.",
  read_only: "Browse the console without changing anything.",
};

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const values = new Uint32Array(20);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export function OperatorsManager({ operators, selfId }: { operators: OperatorView[]; selfId: string }) {
  const [dialog, setDialog] = useState<OperatorView | "new" | null>(null);
  return (
    <>
      <div className="flex justify-end">
        <Button variant="flame" icon="plus" onClick={() => setDialog("new")}>
          Add operator
        </Button>
      </div>
      <Card className="p-5 sm:p-6">
        <TableWrap>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.id}>
                  <td className="font-medium">
                    {operator.email}
                    {operator.id === selfId ? <span className="ml-2 text-[11px] text-[#8a8780]">you</span> : null}
                  </td>
                  <td>{OPERATOR_ROLE_LABELS[operator.role]}</td>
                  <td>
                    <Badge tone={operator.isActive ? "success" : "danger"} dot>
                      {operator.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-[#6b6b6b]">{formatDate(operator.lastLoginAt, true)}</td>
                  <td className="whitespace-nowrap tabular-nums text-[#6b6b6b]">{formatDate(operator.createdAt)}</td>
                  <td className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => setDialog(operator)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <OperatorDialog key={dialog === "new" ? "new" : (dialog?.id ?? "closed")} operator={dialog === "new" ? null : dialog} open={dialog !== null} onClose={() => setDialog(null)} isSelf={dialog !== null && dialog !== "new" && dialog.id === selfId} />
    </>
  );
}

function OperatorDialog({ operator, open, onClose, isSelf }: { operator: OperatorView | null; open: boolean; onClose: () => void; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    try {
      if (operator) {
        await opsRequest("PATCH", `/operators/${operator.id}`, {
          role: text("role"),
          isActive: form.get("isActive") === "on",
          ...(password ? { password } : {}),
        });
        toast.success("Operator updated.");
      } else {
        await opsRequest("POST", "/operators", { email: text("email").toLowerCase(), password, role: text("role") });
        toast.success("Operator added. Share the password over a secure channel.");
      }
      onClose();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} eyebrow="Operators" title={operator ? operator.email : "Add an operator"} maxWidthClass="max-w-lg">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        {operator ? null : (
          <Field label="Email" required>
            <input name="email" type="email" className="ui-input" required maxLength={254} autoComplete="off" />
          </Field>
        )}
        <Field label="Role" required hint={ROLE_HELP[(operator?.role ?? "support") as OperatorRole]}>
          <select name="role" className="ui-input" defaultValue={operator?.role ?? "support"} disabled={isSelf}>
            {OPERATOR_ROLES.map((role) => (
              <option key={role} value={role}>
                {OPERATOR_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        {operator ? (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="isActive" defaultChecked={operator.isActive} disabled={isSelf} />
            Active (disabled operators cannot sign in)
          </label>
        ) : null}
        <Field label={operator ? "New password (optional)" : "Password"} required={!operator} hint="At least 12 characters. Shown here only while this dialog is open.">
          <div className="flex gap-2">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              className="ui-input font-mono"
              minLength={12}
              maxLength={200}
              required={!operator}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
            >
              Generate
            </Button>
          </div>
          <button type="button" className="mt-1 text-[12px] underline underline-offset-4" onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? "Hide" : "Show"} password
          </button>
        </Field>
        {isSelf ? <Notice tone="neutral">You cannot change your own role or disable your own account.</Notice> : null}
        <FormFooter busy={busy} error={error} onCancel={onClose} submitLabel={operator ? "Save operator" : "Add operator"} />
      </form>
    </ModalShell>
  );
}
