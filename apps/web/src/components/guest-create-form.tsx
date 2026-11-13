"use client";
import { savedToastId } from "@/lib/action-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { GuestStaffForm } from "@/lib/guest-fields";
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
  const tf = useTranslations("admin.settings.guestFields");
  const tp = useTranslations("people.prayerCare");
  const locale = useLocale();
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || (branches.length === 1 ? branches[0]?._id : "") || "",
  );
  const [loaded, setLoaded] = useState<{ branchId: string; definition: GuestStaffForm }>();
  const definition = loaded?.branchId === selectedBranchId ? loaded.definition : undefined;
  const [definitionError, setDefinitionError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    fetch(API_URL + "/guests/staff-form" + query, { credentials: "include", signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const definition = await response.json() as GuestStaffForm;
        if (!controller.signal.aborted) {
          setLoaded({ branchId: selectedBranchId, definition });
          setDefinitionError(false);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setDefinitionError(true); });
    return () => controller.abort();
  }, [selectedBranchId]);
  const visible = (key: string) => !definition?.hiddenStaff.includes(key);
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<{ guestId?: string; possible: boolean; identity: string }>();
  const branchMap = new Map(
    branches.map((branch) => [branch._id, branch.name]),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!definition || loading) return;
    const formData = new FormData(event.currentTarget);
    const identity = JSON.stringify([formData.get("branchId") || defaultBranchId, ...["firstName", "lastName", "phone", "email"].map((key) => formData.get(key))]);
    const confirmDistinctGuest = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "distinct" && match?.identity === identity;
    setMatch(undefined);
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
          confirmDistinctGuest,
          email: formData.get("email") || undefined,
          invitedBy: formData.get("invitedBy"),
          heardAboutChurch: formData.get("heardAboutChurch"),
          prayerRequest: formData.get("prayerRequest"),
          wantsPastoralCall: formData.get("wantsPastoralCall") === "on",
          assignedFollowUpUserId:
            formData.get("assignedFollowUpUserId") || undefined,
          serviceType: formData.get("serviceType"),
          visitDate: new Date().toISOString(),
          formRevision: definition.revision,
          customFields: Object.fromEntries(definition.fields.flatMap((field) => {
            const value = formData.get(field.key);
            return typeof value === "string" && value.trim() !== ""
              ? [[field.key, field.type === "number" ? Number(value) : value]]
              : [];
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.code === "guest_possible_match" || result.code === "guest_already_exists") {
          setMatch({ possible: result.code === "guest_possible_match", guestId: result.guestId, identity });
          return;
        }
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
    <form onSubmit={handleSubmit} onChange={() => setMatch(undefined)}>
      {definitionError ? <p role="alert" className="mb-4 text-sm text-red-700">{tf("loadFailed")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {branches.length > 1 ? (
          <Field label={tc("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => { setLoaded(undefined); setDefinitionError(false); setSelectedBranchId(event.target.value); }}
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
        <Field label={t("phoneNumber")}>
          <input
            name="phone"
            placeholder={t("phoneNumber")}
            className="ui-input"
            type="tel"
          />
        </Field>
        {visible("email") ? <Field label={tc("email")}>
          <input
            name="email"
            placeholder="name@example.com"
            type="email"
            className="ui-input"
          />
        </Field> : null}
        {visible("invitedBy") ? <Field label={t("invitedBy")}>
          <input
            name="invitedBy"
            placeholder={t("invitedByPlaceholder")}
            className="ui-input"
          />
        </Field> : null}
        {visible("heardAboutChurch") ? <Field label={t("heardAbout")}>
          <input
            name="heardAboutChurch"
            placeholder={t("heardAboutPlaceholder")}
            className="ui-input"
          />
        </Field> : null}
        {visible("assignedFollowUpUserId") && filteredAssignableUsers.length > 0 ? (
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
        {visible("prayerRequest") ? <Field label={t("prayerRequest")} className="md:col-span-2">
          <textarea
            name="prayerRequest"
            maxLength={2000}
            placeholder={t("prayerRequestPlaceholder")}
            className="ui-input"
          />
        </Field> : null}
        {visible("wantsPastoralCall") ? <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="wantsPastoralCall" /> {tp("contactConfirmed")}
        </label> : null}
        {definition?.fields.map((field) => (
          <Field key={field.key} label={((locale === "es" && field.labelEs) || (locale === "fr" && field.labelFr) || (locale === "pt" && field.labelPt)) || field.label} required={field.required}>
            {field.type === "select" ? (
              <select className="ui-input" name={field.key} required={field.required}>
                <option value="" />
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : field.type === "textarea" ? (
              <textarea className="ui-input" name={field.key} required={field.required} maxLength={2000} />
            ) : (
              <input className="ui-input" name={field.key} required={field.required} type={field.type} min={field.type === "number" ? 0 : undefined} step="any" maxLength={250} />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        {match ? <div role="status" className="space-y-2 rounded-xl bg-amber-50 p-3">
          <p>{tc(match.possible ? "guestMatch.possible" : "guestMatch.existing")}</p>
          {match.guestId ? <Link className="underline" href={`/guests/${match.guestId}`}>{tc("guestMatch.open")}</Link> : null}
          {match.possible ? <Button type="submit" value="distinct" disabled={loading}>{tc("guestMatch.confirm")}</Button> : null}
        </div> : null}
        <Button type="submit" disabled={loading || !definition}>
          {loading ? tc("saving") : t("saveGuest")}
        </Button>
      </div>
    </form>
  );
}
