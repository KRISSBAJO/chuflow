"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AttendanceSubmissionQueue } from "@/components/attendance-submission-queue";
import { Button } from "@/components/ui/ui";
import type { AttendanceSubmissionItem } from "@/lib/types";
export function AttendanceReviewList({
  items,
  canApprove,
}: {
  items: AttendanceSubmissionItem[];
  canApprove: boolean;
}) {
  const t = useTranslations("workspace");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const filtered = items.filter((i) => !status || i.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages);
  return (
    <div className="space-y-4">
      <select
        aria-label={t("status")}
        value={status}
        className="ui-input max-w-xs"
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">{t("allStatuses")}</option>
        {["pending", "approved", "rejected"].map((s) => (
          <option key={s} value={s}>
            {t(s as "pending" | "approved" | "rejected")}
          </option>
        ))}
      </select>
      <AttendanceSubmissionQueue
        items={filtered.slice((current - 1) * 20, current * 20)}
        canApprove={canApprove}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          {t("previous")}
        </Button>
        <span className="text-xs">
          {t("page", { page: current, total: pages })}
        </span>
        <Button
          variant="secondary"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
