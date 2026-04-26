import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { GuestDuplicatePanel } from "@/components/guest-duplicate-panel";
import { GuestCreateModalButton } from "@/components/guest-create-modal-button";
import { TemplateQrCard } from "@/components/template-qr-card";
import { requireServerRole } from "@/lib/auth";
import { canFilterAcrossBranches } from "@/lib/permissions";
import { publicServerGet, serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  GuestDuplicateGroup,
  GuestListResponse,
  PublicConnectOption,
  ServiceTypeSummary,
  UserSummary,
} from "@/lib/types";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; branchId?: string; page?: string }>;
}) {
  const user = await requireServerRole("/guests");

  const params = await searchParams;
  const search = params.search?.trim();
  const canChooseBranch = canFilterAcrossBranches(user.role);
  const selectedBranchId = canChooseBranch ? params.branchId?.trim() : user.branchId;
  const requestedPage = Math.max(Number(params.page) || 1, 1);
  const queryParams = new URLSearchParams();

  if (search) {
    queryParams.set("search", search);
  }

  if (selectedBranchId) {
    queryParams.set("branchId", selectedBranchId);
  }

  queryParams.set("page", String(requestedPage));
  queryParams.set("limit", "20");

  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const [guestList, branches, users, duplicateGroups, serviceTypes, publicGuestTemplates] = await Promise.all([
    serverGet<GuestListResponse>(`/guests${query}`),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<UserSummary[]>(selectedBranchId ? `/users?branchId=${encodeURIComponent(selectedBranchId)}` : "/users").catch(() => []),
    serverGet<GuestDuplicateGroup[]>(selectedBranchId ? `/guests/duplicates?branchId=${encodeURIComponent(selectedBranchId)}` : "/guests/duplicates").catch(() => []),
    serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
    publicServerGet<PublicConnectOption[]>("/intake-templates/public/templates?kind=guest").catch(() => []),
  ]);

  const guests = guestList.items;
  const duplicateCount = duplicateGroups.length;
  const selectedBranch = branches.find((branch) => branch._id === selectedBranchId);
  const scopedGuestTemplates = selectedBranchId
    ? publicGuestTemplates.filter((template) => template.branch?._id === selectedBranchId)
    : publicGuestTemplates;
  const guestTemplateCards =
    selectedBranchId || !canChooseBranch
      ? scopedGuestTemplates.slice(0, 1)
      : scopedGuestTemplates;
  const fallbackPublicGuestUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"}/connect`;
  const publicGuestUrl = guestTemplateCards[0]?.shareUrl || fallbackPublicGuestUrl;
  const scopeLabel = selectedBranch
    ? `${selectedBranch.name} guest records`
    : canChooseBranch
      ? "All visible branches"
      : "Current branch";
  const paginationQueryBase = new URLSearchParams();

  if (search) {
    paginationQueryBase.set("search", search);
  }

  if (selectedBranchId) {
    paginationQueryBase.set("branchId", selectedBranchId);
  }

  function buildPageHref(page: number) {
    const query = new URLSearchParams(paginationQueryBase);
    query.set("page", String(page));
    return `/guests?${query.toString()}`;
  }

  const startItem = guestList.pagination.total === 0 ? 0 : (guestList.pagination.page - 1) * guestList.pagination.pageSize + 1;
  const endItem = Math.min(
    guestList.pagination.page * guestList.pagination.pageSize,
    guestList.pagination.total,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Guests"
        title="Guest registry and first-touch coordination"
        description="Every connect card, usher-assisted registration, and QR form submission should land here with immediate next action clarity."
        action={
          <GuestCreateModalButton
            branches={branches}
            users={users}
            serviceTypes={serviceTypes}
            defaultBranchId={selectedBranchId || user.branchId}
            label="New guest"
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
          />
        }
      />
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Registered today" value={String(guestList.summary.todayCount)} delta="Fresh guest records created today" tone="warm" />
        <MetricCard label="Possible duplicates" value={String(duplicateCount)} delta="Duplicate groups detected in the current scope" tone="cool" />
        <MetricCard
          label="Assigned follow-up"
          value={String(guestList.summary.assignedFollowUpCount)}
          delta={`${Math.max(guestList.pagination.total - guestList.summary.assignedFollowUpCount, 0)} still unassigned`}
          tone="warm"
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="surface overflow-hidden rounded-[24px]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Latest guests</h2>
              <p className="mt-1 text-xs text-slate-500">{scopeLabel}</p>
            </div>
            <form className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[1fr_0.9fr_auto]">
              <input
                name="search"
                defaultValue={search}
                placeholder="Search name, phone, email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              />
              {canChooseBranch ? (
                <select
                  name="branchId"
                  defaultValue={selectedBranchId || ""}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input type="hidden" name="page" value="1" />
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                Apply
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Guest", "Branch", "Service date", "Status", "Next step"].map((column) => (
                    <th key={column} className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {guests.length > 0 ? (
                  guests.map((guest) => (
                    <tr key={guest._id} className="border-t border-slate-100">
                      <td className="px-5 py-3.5">
                        <Link href={`/guests/${guest._id}`} className="font-semibold text-slate-900 hover:text-orange-700">
                          {guest.firstName} {guest.lastName}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">{guest.email || guest.phone}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{guest.branchId?.name ?? "Unassigned"}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {guest.createdAt ? new Date(guest.createdAt).toLocaleDateString() : "No date"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800">
                          {guest.visitStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">
                        {guest.nextFollowUpStatus?.replace("_", " ") ?? "Awaiting follow-up"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-100">
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                      No guests match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Showing {startItem}-{endItem} of {guestList.pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildPageHref(Math.max(guestList.pagination.page - 1, 1))}
                aria-disabled={guestList.pagination.page <= 1}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  guestList.pagination.page <= 1
                    ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                Previous
              </Link>
              <span className="text-sm text-slate-500">
                Page {guestList.pagination.page} of {guestList.pagination.totalPages}
              </span>
              <Link
                href={buildPageHref(Math.min(guestList.pagination.page + 1, guestList.pagination.totalPages))}
                aria-disabled={guestList.pagination.page >= guestList.pagination.totalPages}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  guestList.pagination.page >= guestList.pagination.totalPages
                    ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <section id="guest-capture" className="surface rounded-[24px] p-5">
            <p className="eyebrow">Guest capture desk</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Use the full desk form or public intake</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {selectedBranch
                ? `Desk staff can use the full assisted-registration modal here, while QR and self-registration can use the live public guest form for ${selectedBranch.name}.`
                : canChooseBranch
                  ? "Pick a branch when you need a branch-specific desk form or public guest link. Without a branch filter, you are seeing your full visible network."
                  : "Desk staff can use the full assisted-registration modal here, while QR and self-registration can use the live public guest form for this branch."}
            </p>
            <div className="mt-4">
              <GuestCreateModalButton
                branches={branches}
                users={users}
                serviceTypes={serviceTypes}
                defaultBranchId={selectedBranchId || user.branchId}
                label="Open desk registration form"
                className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
              />
            </div>
          </section>
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Public guest intake</p>
            <div className="mt-4">
              {guestTemplateCards.length > 0 ? (
                <div className="space-y-4">
                  {guestTemplateCards.map((template) => (
                    <TemplateQrCard
                      key={template._id}
                      url={template.shareUrl || `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"}/intake/${template.slug}`}
                      title={
                        canChooseBranch && !selectedBranchId
                          ? `${template.branch?.name ?? template.name} guest share link`
                          : `${template.name} share link`
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  {canChooseBranch && !selectedBranchId
                    ? "Choose a branch to load its public guest link, or activate guest templates in Templates if none are live yet."
                    : "No active public guest template is available yet. Activate one in Templates to expose self-registration."}
                </div>
              )}
            </div>
          </section>
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Capture channels</p>
            <div className="mt-3 space-y-2">
              <a
                href={guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"}
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-orange-200 hover:text-orange-700"
              >
                <span>Public self-registration</span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Open
                </span>
              </a>
              <a
                href={guestTemplateCards.length > 0 ? publicGuestUrl : "/templates"}
                target={guestTemplateCards.length > 0 ? "_blank" : undefined}
                rel={guestTemplateCards.length > 0 ? "noreferrer" : undefined}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-orange-200 hover:text-orange-700"
              >
                <span>QR code connect card</span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Share
                </span>
              </a>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <GuestCreateModalButton
                  branches={branches}
                  users={users}
                  serviceTypes={serviceTypes}
                  defaultBranchId={selectedBranchId || user.branchId}
                  label="Usher desk registration"
                  className="w-full text-left text-sm font-medium text-slate-700"
                />
              </div>
              <a
                href={guestTemplateCards.length > 0 ? publicGuestUrl : "/connect"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-orange-200 hover:text-orange-700"
              >
                <span>Church tablet kiosk</span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Launch
                </span>
              </a>
            </div>
          </section>
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Data quality</p>
            <div className="mt-3 rounded-[20px] bg-slate-950 p-4 text-white">
              <p className="text-2xl font-bold">{guestList.summary.completionRate}%</p>
              <p className="mt-1.5 text-sm text-slate-300">Guest cards completed with both phone and email</p>
            </div>
          </section>
          <GuestDuplicatePanel groups={duplicateGroups} />
        </div>
      </section>
    </Shell>
  );
}
