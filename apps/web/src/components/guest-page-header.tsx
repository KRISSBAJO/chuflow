"use client";
import { ImportLink } from "@/components/import-link";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { GuestCreateForm } from "@/components/guest-create-form";
import { Button, Card, CardHeader } from "@/components/ui/ui";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

export function GuestPageHeader({
  branches,
  users,
  serviceTypes,
  defaultBranchId,
}: {
  branches: BranchSummary[];
  users: UserSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("people.guests.header");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <Card className="app-rise p-6 sm:p-7">
        <CardHeader
          label={t("captureLabel")}
          title={t("registerTitle")}
          description={t("registerDescription")}
          action={
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              {tc("cancel")}
            </Button>
          }
        />
        <div className="mt-6">
          <GuestCreateForm
            branches={branches}
            users={users}
            serviceTypes={serviceTypes}
            defaultBranchId={defaultBranchId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="app-rise flex flex-col gap-6 pt-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="lp-label">{t("eyebrow")}</p>
        <h1 className="lp-heading mt-3 text-[2rem] leading-[1.08] sm:text-[2.5rem]">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#6b6b6b]">
          {t("description")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <ImportLink kind="guests" />
        <Button icon="plus" onClick={() => router.push("/guests/new")}>
          {t("newGuest")}
        </Button>
      </div>
    </div>
  );
}
