"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMessages, useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { Button, ButtonLink, Card, Field } from "@/components/ui/ui";
import { useRoleLabel } from "@/i18n/labels";
import type { PermissionDetail, PermissionPerson } from "./types";
export function PermissionEditor({
  userId,
  initialPermission,
}: {
  userId?: string;
  initialPermission?: string;
}) {
  const t = useTranslations("permissionManager");
  const names = useMessages().permissionManager.names as Record<string, string>;
  const format = useFormatter();
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const [detail, setDetail] = useState<PermissionDetail | null>(null);
  const [failed, setFailed] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<PermissionPerson[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searching, setSearching] = useState(false);
  const [keys, setKeys] = useState<string[]>(
    initialPermission ? [initialPermission] : [],
  );
  const [duration, setDuration] = useState("thirty");
  const [minimumDate, setMinimumDate] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setMinimumDate(
        new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      );
    };
    queueMicrotask(update);
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    apiGet<PermissionDetail>(`/permissions/users/${userId}`)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((error) => {
        if (!cancelled)
          setFailed(error instanceof Error ? error.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, t]);
  useEffect(() => {
    if (userId || search.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      apiGet<{ items: PermissionPerson[]; totalPages: number }>(
        `/permissions/users?search=${encodeURIComponent(search)}&page=${searchPage}`,
      )
        .then((result) => {
          if (!cancelled) {
            setUsers(result.items);
            setTotalPages(result.totalPages);
          }
        })
        .catch(() => {
          if (!cancelled) toast.error(t("loadError"));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, userId, searchPage, t]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    if (!keys.length) {
      toast.error(t("chooseRequired"));
      return;
    }
    if (reason.trim().length < 3) {
      toast.error(t("reasonRequired"));
      return;
    }
    let expiresAt: string | undefined;
    if (duration !== "never") {
      const expiry =
        duration === "custom"
          ? new Date(date)
          : new Date(Date.now() + (duration === "seven" ? 7 : 30) * 86400000);
      if (
        !Number.isFinite(expiry.getTime()) ||
        expiry.getTime() <= Date.now()
      ) {
        toast.error(t("dateRequired"));
        return;
      }
      expiresAt = expiry.toISOString();
    }
    setBusy(true);
    try {
      await apiPost("/permissions/delegations", {
        recipientId: detail.user._id,
        permissions: keys,
        expiresAt,
        expectedRevision: detail.revision,
        reason: reason.trim(),
      });
      toast.success(t("saved"));
      router.push(`/permissions?userId=${detail.user._id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  }
  if (!userId)
    return (
      <Card className="mx-auto max-w-3xl p-6">
        <h2 className="text-xl font-semibold">{t("chooseUser")}</h2>
        <p className="my-3 text-sm text-[#6b6b6b]">{t("chooseHint")}</p>
        <Field label={t("searchUsers")}>
          <input
            autoFocus
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchPage(1);
              setUsers([]);
              setTotalPages(1);
            }}
          />
        </Field>
        {searching && (
          <p role="status" className="mt-4 text-sm">
            {t("loading")}
          </p>
        )}
        <ul className="mt-5 divide-y divide-black/5">
          {users.map((user) => (
            <li
              key={user._id}
              className="flex items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-[#6b6b6b]">
                  {user.email} · {roleLabel(user.role)}
                </p>
              </div>
              <ButtonLink
                variant="secondary"
                href={`/permissions/new?userId=${user._id}`}
              >
                {t("select")}
              </ButtonLink>
            </li>
          ))}
        </ul>
        {totalPages > 1 && search.trim().length >= 2 && (
          <div className="mt-4 flex justify-between gap-3">
            <Button
              variant="secondary"
              disabled={searchPage <= 1}
              onClick={() => setSearchPage((p) => p - 1)}
            >
              {t("prev")}
            </Button>
            <span>{t("page", { page: searchPage, total: totalPages })}</span>
            <Button
              variant="secondary"
              disabled={searchPage >= totalPages}
              onClick={() => setSearchPage((p) => p + 1)}
            >
              {t("next")}
            </Button>
          </div>
        )}
      </Card>
    );
  if (failed)
    return (
      <Card className="p-6" role="alert">
        {failed}
      </Card>
    );
  if (!detail) return <p role="status">{t("loading")}</p>;
  const available = detail.catalog.filter(
    (p) =>
      detail.assignable.includes(p.key) &&
      !detail.basePermissions.includes(p.key),
  );
  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <Card className="p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-orange-700">
          {t("scope")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          {detail.user.firstName} {detail.user.lastName}
        </h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          {detail.user.email} · {roleLabel(detail.user.role)}
        </p>
        <p className="mt-4 text-sm text-[#6b6b6b]">{t("unchanged")}</p>
      </Card>
      {!detail.canEdit ? (
        <Card className="p-6">{t("self")}</Card>
      ) : (
        <>
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">
              {t("selectPermissions")}
            </h3>
            {!available.length && <p>{t("noAssignable")}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {available.map((permission) => (
                <label
                  key={permission.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-white p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-orange-600"
                    checked={keys.includes(permission.key)}
                    onChange={(e) =>
                      setKeys((old) =>
                        e.target.checked
                          ? [...old, permission.key]
                          : old.filter((k) => k !== permission.key),
                      )
                    }
                  />
                  <span className="text-sm">
                    <span className="font-medium">
                      {names[permission.key.replace(".", "_")]}
                    </span>
                    {detail.additionalPermissions.includes(permission.key) && (
                      <span className="mt-1 block text-xs text-orange-700">
                        {t("existing")}
                      </span>
                    )}
                    {permission.requires.length > 0 && (
                      <span className="mt-1 block text-xs text-[#6b6b6b]">
                        +{" "}
                        {permission.requires
                          .map((key) => names[key.replace(".", "_")])
                          .join(", ")}
                      </span>
                    )}
                    {detail.maximumExpiries[permission.key] && (
                      <span className="mt-1 block text-xs text-[#6b6b6b]">
                        {t("expiresBy", {
                          date: format.dateTime(
                            new Date(detail.maximumExpiries[permission.key]!),
                            { dateStyle: "medium", timeStyle: "short" },
                          ),
                        })}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <details className="mt-5 text-sm text-[#6b6b6b]">
              <summary className="cursor-pointer">{t("roleIncluded")}</summary>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {detail.basePermissions.map((key) => (
                  <li key={key}>✓ {names[key.replace(".", "_")]}</li>
                ))}
              </ul>
            </details>
          </Card>
          <Card className="grid gap-5 p-6">
            <Field label={t("duration")}>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {(["seven", "thirty", "custom", "never"] as const).map(
                  (key) => (
                    <option key={key} value={key}>
                      {t(key)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            {duration === "custom" && (
              <Field label={t("expiry")}>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  min={minimumDate}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            )}
            <Field label={t("reason")}>
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonHint")}
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <ButtonLink
                variant="secondary"
                href={`/permissions?userId=${detail.user._id}`}
              >
                {t("cancel")}
              </ButtonLink>
              <Button type="submit" disabled={busy || !keys.length}>
                {busy ? t("saving") : t("save")}
              </Button>
            </div>
          </Card>
        </>
      )}
    </form>
  );
}
