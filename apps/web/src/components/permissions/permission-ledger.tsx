"use client";
import { ExportMenu } from "@/components/export-menu";
import { ModalShell } from "@/components/modal-shell";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { useMessages, useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { Badge, Button, ButtonLink, Card, Field } from "@/components/ui/ui";
import type { GrantList, GrantRow } from "./types";

export function PermissionLedger({ recipientId }: { recipientId?: string }) {
  const t = useTranslations("permissionManager");
  const format = useFormatter();
  const names = useMessages().permissionManager.names as Record<string, string>;
  const [data, setData] = useState<GrantList | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [byMe, setByMe] = useState(false);
  const [revoking, setRevoking] = useState<GrantRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const revision = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const q = new URLSearchParams({
        page: String(page),
        search,
        status,
        byMe: String(byMe),
      });
      if (recipientId) q.set("recipientId", recipientId);
      const result = await apiGet<GrantList>(`/permissions/delegations?${q}`);
      if (revision === requestId.current) setData(result);
    } catch {
      if (revision === requestId.current) setError(true);
    } finally {
      if (revision === requestId.current) setLoading(false);
    }
  }, [page, search, status, byMe, recipientId]);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void load();
    });
    return () => {
      mounted = false;
    };
  }, [load]);
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (!revoking) return;
    if (reason.trim().length < 3) {
      toast.error(t("reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await apiPost(
        revoking._id === "all"
          ? `/permissions/users/${revoking.recipient._id}/revoke-all`
          : `/permissions/delegations/${revoking._id}/revoke`,
        {
          expectedRevision: revoking.recipient.permissionRevision || 0,
          reason: reason.trim(),
        },
      );
      toast.success(t("revokedSuccess"));
      setRevoking(null);
      setReason("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6b6b6b]">
          {data ? t("count", { count: data.total }) : t("loading")}
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            resource="permission-grants"
            filters={{
              search,
              status,
              byMe: String(byMe),
              ...(recipientId ? { recipientId } : {}),
            }}
          />
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {t("refresh")}
          </Button>
          {recipientId &&
            data?.items.some(
              (row) => row.canManage && row.status !== "revoked",
            ) && (
              <Button
                variant="secondary"
                onClick={() => {
                  const row = data.items.find((row) => row.canManage);
                  if (row) {
                    setRevoking({ ...row, _id: "all" });
                    setReason("");
                  }
                }}
              >
                {t("revokeAll")}
              </Button>
            )}
          <ButtonLink
            href={
              recipientId
                ? `/permissions/new?userId=${recipientId}`
                : "/permissions/new"
            }
            icon="plus"
          >
            {t("add")}
          </ButtonLink>
        </div>
      </div>
      <details className="rounded-2xl border border-black/10 bg-[#f6f5f1] p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t("filters")}
          {search || status || byMe ? " •" : ""}
        </summary>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
        >
          <Field label={t("search")}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field label={t("status")}>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {(["", "active", "expired", "revoked"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(value || "all")}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={byMe}
              onChange={(e) => {
                setByMe(e.target.checked);
                setPage(1);
              }}
            />
            {t("byMe")}
          </label>
          <Button type="submit">{t("apply")}</Button>
        </form>
      </details>
      {error ? (
        <Card className="p-6" role="alert">
          <p>{t("loadError")}</p>
          <Button variant="secondary" onClick={() => void load()}>
            {t("retry")}
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0" aria-busy={loading}>
          <div className="overflow-x-auto">
            <table className="ui-table min-w-[850px] w-full">
              <thead>
                <tr>
                  {(
                    [
                      "recipient",
                      "permission",
                      "issuer",
                      "expiry",
                      "status",
                      "actions",
                    ] as const
                  ).map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <Link
                        href={`/permissions?userId=${row.recipient._id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.recipient.firstName} {row.recipient.lastName}
                      </Link>
                      <p className="text-xs text-[#6b6b6b]">
                        {row.recipient.email}
                      </p>
                    </td>
                    <td>
                      {names[row.permission.replace(".", "_")] ||
                        row.permission}
                      <details className="mt-1 text-xs text-[#6b6b6b]">
                        <summary className="cursor-pointer">
                          {t("details")}
                        </summary>
                        <p className="mt-2">
                          {t("issued")}: {date(row.grantedAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{row.reason}</p>
                        {row.revokedAt && (
                          <p className="mt-2">
                            {t("revoked")}: {date(row.revokedAt)}
                            <br />
                            {row.revokedByName}
                            <br />
                            {row.revocationReason}
                          </p>
                        )}
                      </details>
                    </td>
                    <td className="text-xs">{row.grantedByName}</td>
                    <td>{row.expiresAt ? date(row.expiresAt) : t("never")}</td>
                    <td>
                      <Badge
                        tone={
                          row.status === "active"
                            ? "success"
                            : row.status === "needs_review"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {t(row.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {row.canManage && (
                          <ButtonLink
                            size="sm"
                            variant="secondary"
                            href={`/permissions/new?userId=${row.recipient._id}&permission=${encodeURIComponent(row.permission)}`}
                          >
                            {t("renew")}
                          </ButtonLink>
                        )}
                        {row.canManage && row.status !== "revoked" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRevoking(row);
                              setReason("");
                            }}
                          >
                            {t("revoke")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.items.length && (
            <p className="p-8 text-center text-sm text-[#6b6b6b]" role="status">
              {loading ? t("loading") : t("empty")}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-black/5 p-4 text-sm">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("prev")}
            </Button>
            <span>{t("page", { page, total: data?.totalPages || 1 })}</span>
            <Button
              variant="secondary"
              disabled={page >= (data?.totalPages || 1) || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </Card>
      )}
      <p className="text-xs leading-relaxed text-[#6b6b6b]">
        {t("pausedHint")} {t("history")}
      </p>
      <ModalShell
        open={!!revoking}
        onClose={() => {
          if (!busy) setRevoking(null);
        }}
        eyebrow={t("permissionCard")}
        title={revoking?._id === "all" ? t("revokeAll") : t("revokeTitle")}
        description={t("revokeHint")}
        maxWidthClass="max-w-lg"
      >
        {revoking && (
          <form onSubmit={revoke}>
            <p className="mb-4 font-medium">
              {revoking.recipient.firstName} {revoking.recipient.lastName}
              {revoking._id !== "all" && (
                <> · {names[revoking.permission.replace(".", "_")]}</>
              )}
            </p>
            <Field label={t("reason")}>
              <textarea
                autoFocus
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setRevoking(null)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("saving") : t("confirmRevoke")}
              </Button>
            </div>
          </form>
        )}
      </ModalShell>
    </div>
  );
}
