"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "./ops-dialogs";
import { Button } from "@/components/ui/ui";
import { opsRequest } from "@/lib/ops/client";
import { can, type OperatorRole, type WorkspaceView } from "@/lib/ops/types";

type Action = "suspend" | "reactivate" | "archive";

export function WorkspaceActions({ workspace, role }: { workspace: WorkspaceView; role: OperatorRole }) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  if (workspace.primary || workspace.status === "archived") return null;

  async function run(action: Action, reason: string) {
    await opsRequest("POST", `/workspaces/${workspace.id}/${action}`, reason ? { reason } : {});
    toast.success(action === "suspend" ? "Workspace suspended." : action === "reactivate" ? "Workspace reactivated." : "Workspace archived.");
    router.refresh();
  }

  return (
    <>
      {workspace.status === "active" && can.suspend(role) ? (
        <Button variant="secondary" onClick={() => setOpen("suspend")}>
          Suspend
        </Button>
      ) : null}
      {workspace.status === "suspended" && can.suspend(role) ? (
        <Button variant="primary" onClick={() => setOpen("reactivate")}>
          Reactivate
        </Button>
      ) : null}
      {can.archive(role) ? (
        <Button variant="danger" onClick={() => setOpen("archive")}>
          Archive
        </Button>
      ) : null}

      <ReasonDialog
        open={open === "suspend"}
        onClose={() => setOpen(null)}
        eyebrow="Suspend"
        title={`Suspend ${workspace.name}`}
        description="Every sign-in and API call for this church answers 402 until it is reactivated. Data is untouched."
        confirmLabel="Suspend workspace"
        danger
        onConfirm={(reason) => run("suspend", reason)}
      />
      <ReasonDialog
        open={open === "reactivate"}
        onClose={() => setOpen(null)}
        eyebrow="Reactivate"
        title={`Reactivate ${workspace.name}`}
        description="The gateway starts serving the workspace again within half a minute."
        confirmLabel="Reactivate"
        optional
        onConfirm={(reason) => run("reactivate", reason)}
      />
      <ReasonDialog
        open={open === "archive"}
        onClose={() => setOpen(null)}
        eyebrow="Archive"
        title={`Archive ${workspace.name}`}
        description="The gateway stops serving the workspace and it leaves the active list. Its database is kept; archiving cannot be undone from the console."
        confirmLabel="Archive workspace"
        danger
        onConfirm={(reason) => run("archive", reason)}
      />
    </>
  );
}
