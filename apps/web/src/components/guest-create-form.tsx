"use client";
import { savedToastId } from "@/lib/action-feedback";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type {
  BranchSummary,
  ServiceTypeSummary,
  UserSummary,
} from "@/lib/types";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function GuestCreateForm({
  branches,
  defaultBranchId,
  users = [],
  serviceTypes = [],
  onSuccess,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
  users?: UserSummary[];
  serviceTypes?: ServiceTypeSummary[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("people.guests.create");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const branchMap = new Map(
    branches.map((branch) => [branch._id, branch.name]),
  );
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || (branches.length === 1 ? branches[0]?._id : "") || "",
  );
  const selectedBranch =
    branches.find((branch) => branch._id === selectedBranchId) ||
    (branches.length === 1 ? branches[0] : undefined);
  const assignableUsers = users.filter((user) =>
    [
      "branch_admin",
      "resident_pastor",
      "associate_pastor",
      "follow_up",
    ].includes(user.role),
  );
  const filteredAssignableUsers = useMemo(
    () =>
      assignableUsers.filter((user) =>
        selectedBranchId
          ? !user.branchId || user.branchId === selectedBranchId
          : true,
      ),
    [assignableUsers, selectedBranchId],
  );
  const filteredServiceTypes = useMemo(
    () =>
      serviceTypes.filter((serviceType) =>
        selectedBranchId
          ? getBranchId(serviceType.branchId) === selectedBranchId
          : true,
      ),
    [selectedBranchId, serviceTypes],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: formData.get("branchId") || defaultBranchId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          invitedBy: formData.get("invitedBy"),
          heardAboutChurch: formData.get("heardAboutChurch"),
          prayerRequest: formData.get("prayerRequest"),
          assignedFollowUpUserId:
            formData.get("assignedFollowUpUserId") || undefined,
          serviceType: formData.get("serviceType"),
          visitDate: new Date().toISOString(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("errorCreate"));
      }

      toast.success(t("savedTitle"), {
        id: savedToastId(result),
        description: t("savedDescription"),
      });
      onSuccess?.();
      router.push(
        createdHref(`/guests/${result._id}`, result, t("entityName")),
      );
      router.refresh();
    } catch (error) {
      toast.error(t("notSavedTitle"), {
        description: error instanceof Error ? error.message : t("errorCreate"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        {branches.length > 1 ? (
          <Field label={tc("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">{tc("selectBranch")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : selectedBranch ? (
          <Field label={tc("branch")}>
            <input type="hidden" name="branchId" value={selectedBranch._id} />
            <input
              value={selectedBranch.name}
              readOnly
              disabled
              className="ui-input"
            />
          </Field>
        ) : (
          <Field label={tc("branch")}>
            <input
              type="hidden"
              name="branchId"
              value={defaultBranchId ?? ""}
            />
            <input
              value={t("currentBranchScope")}
              readOnly
              disabled
              className="ui-input"
            />
          </Field>
        )}
        <Field label={t("serviceType")} required>
          {filteredServiceTypes.length > 0 ? (
            <select
              name="serviceType"
              defaultValue={filteredServiceTypes[0]?.name || ""}
              className="ui-input"
              required
            >
              <option value="">{t("selectServiceType")}</option>
              {filteredServiceTypes.map((serviceType) => (
                <option key={serviceType._id} value={serviceType.name}>
                  {serviceType.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="serviceType"
              placeholder={t("serviceType")}
              defaultValue="Sunday service"
              className="ui-input"
              required
            />
          )}
        </Field>
        <Field label={tc("firstName")} required>
          <input
            name="firstName"
            placeholder={tc("firstName")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={tc("lastName")} required>
          <input
            name="lastName"
            placeholder={tc("lastName")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("phoneNumber")} required>
          <input
            name="phone"
            placeholder={t("phoneNumber")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={tc("email")}>
          <input
            name="email"
            placeholder="name@example.com"
            type="email"
            className="ui-input"
          />
        </Field>
        <Field label={t("invitedBy")}>
          <input
            name="invitedBy"
            placeholder={t("invitedByPlaceholder")}
            className="ui-input"
          />
        </Field>
        <Field label={t("heardAbout")}>
          <input
            name="heardAboutChurch"
            placeholder={t("heardAboutPlaceholder")}
            className="ui-input"
          />
        </Field>
        {filteredAssignableUsers.length > 0 ? (
          <Field label={t("followUpOwner")} className="md:col-span-2">
            <select name="assignedFollowUpUserId" className="ui-input">
              <option value="">{t("leaveUnassigned")}</option>
              {filteredAssignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                  {user.branchId
                    ? ` · ${branchMap.get(user.branchId) || t("assignedBranch")}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={t("prayerRequest")} className="md:col-span-2">
          <textarea
            name="prayerRequest"
            placeholder={t("prayerRequestPlaceholder")}
            className="ui-input"
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? tc("saving") : t("saveGuest")}
        </Button>
      </div>
    </form>
  );
}
