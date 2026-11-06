"use client";
import { toast } from "sonner";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
} from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { GuestDuplicateGroup } from "@/lib/types";

export function GuestDuplicatePanel({
  groups,
}: {
  groups: GuestDuplicateGroup[];
}) {
  const router = useRouter();
  const t = useTranslations("people.guests.duplicates");

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function mergeGuests(
    targetGuestId: string,
    sourceGuestId: string,
    mergeKey: string,
  ) {
    setLoadingKey(mergeKey);

    try {
      const response = await fetch(`${API_URL}/guests/${targetGuestId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceGuestId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorMerge"));
      }

      toast.success(t("merged"));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errorMerge"));
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <CardHeader
        label={t("label")}
        title={t("title")}
        action={
          <Badge tone={groups.length > 0 ? "warning" : "neutral"}>
            {t("groups", { count: groups.length })}
          </Badge>
        }
      />
      <div className="mt-5 space-y-3">
        {groups.length === 0 ? (
          <EmptyState icon="guests" title={t("noneTitle")}>
            {t("noneBody")}
          </EmptyState>
        ) : (
          groups.slice(0, 6).map((group) => {
            const [target, ...sources] = group.guests;

            return (
              <div
                key={group.key}
                className="rounded-2xl border border-black/[0.06] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-[14px] font-medium text-[#111111]">
                      {group.type === "email"
                        ? t("sharedEmail")
                        : t("sharedPhone")}{" "}
                      · {group.value}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8a8780]">
                      {t("keepFirst")}
                    </p>
                  </div>
                  <Link
                    href={`/guests/${target._id}`}
                    className="text-[13px] font-medium text-[#111111] underline-offset-4 hover:text-[#ea580c] hover:underline"
                  >
                    {t("openPrimary")}
                  </Link>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-[#f6f5f1] px-3 py-2.5 text-[14px]">
                    <p className="font-medium text-[#111111]">
                      <span className="text-[#6b6b6b]">{t("primary")}</span>{" "}
                      {target.firstName} {target.lastName}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
                      {target.email || target.phone}
                    </p>
                  </div>
                  {sources.map((guest) => {
                    const mergeKey = `${target._id}-${guest._id}`;
                    return (
                      <div
                        key={guest._id}
                        className="flex flex-col gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0 text-[14px]">
                          <p className="font-medium text-[#111111]">
                            {guest.firstName} {guest.lastName}
                          </p>
                          <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
                            {guest.email || guest.phone}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={loadingKey === mergeKey || pending}
                          onClick={() =>
                            mergeGuests(target._id, guest._id, mergeKey)
                          }
                        >
                          {loadingKey === mergeKey
                            ? t("merging")
                            : t("mergeIntoPrimary")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
