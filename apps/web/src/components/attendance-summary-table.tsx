"use client";

import { useMemo, useState } from "react";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { ModalShell } from "@/components/modal-shell";
import type {
  AttendanceItem,
  BranchSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

function getBranchId(value: AttendanceItem["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getBranchName(value: AttendanceItem["branchId"], branches: BranchSummary[]) {
  if (typeof value === "string") {
    return branches.find((branch) => branch._id === value)?.name || "Branch";
  }

  if (value?.name) {
    return value.name;
  }

  if (value?._id) {
    return branches.find((branch) => branch._id === value._id)?.name || "Branch";
  }

  return "Branch";
}

export function AttendanceSummaryTable({
  records,
  branches,
  serviceTypes,
  serviceSchedules,
  defaultBranchId,
  canEdit = true,
}: {
  records: AttendanceItem[];
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
  canEdit?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState(defaultBranchId || "");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<AttendanceItem | null>(null);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const branchId = getBranchId(record.branchId);
        const serviceDate = record.serviceDate.slice(0, 10);
        const serviceLabel = `${record.serviceName || ""} ${record.serviceTypeLabel || ""} ${record.serviceType || ""}`.toLowerCase();

        if (branchFilter && branchId !== branchFilter) {
          return false;
        }

        if (
          serviceTypeFilter &&
          record.serviceType !== serviceTypeFilter &&
          record.serviceTypeId?._id !== serviceTypeFilter
        ) {
          return false;
        }

        if (dateFrom && serviceDate < dateFrom) {
          return false;
        }

        if (dateTo && serviceDate > dateTo) {
          return false;
        }

        if (normalizedSearch && !serviceLabel.includes(normalizedSearch)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => new Date(right.serviceDate).getTime() - new Date(left.serviceDate).getTime());
  }, [branchFilter, dateFrom, dateTo, records, search, serviceTypeFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search service name or type"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
          <select
            value={branchFilter}
            onChange={(event) => {
              setBranchFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            value={serviceTypeFilter}
            onChange={(event) => {
              setServiceTypeFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="">All service types</option>
            {serviceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType.key}>
                {serviceType.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
            No service summaries match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    "Date",
                    "Branch",
                    "Service",
                    "Type",
                    "Men",
                    "Women",
                    "Children",
                    "Adults",
                    "First timers",
                    "New converts",
                    "Holy Spirit",
                    ...(canEdit ? ["Action"] : []),
                  ].map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record._id} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(record.serviceDate).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {getBranchName(record.branchId, branches)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {record.serviceName || "Not named"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {record.serviceTypeLabel || record.serviceType}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{record.menCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{record.womenCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{record.childrenCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{record.adultsCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{record.firstTimersCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{record.newConvertsCount ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {record.holySpiritBaptismCount ?? 0}
                    </td>
                    {canEdit ? (
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setEditingRecord(record)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {filteredRecords.length > 0
              ? `Showing ${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filteredRecords.length)} of ${filteredRecords.length}`
              : "No summaries found"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {canEdit ? (
        <ModalShell
          open={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          eyebrow="Attendance"
          title="Edit service summary"
          description="Adjust the recorded totals, service type, or service metadata for this summary."
        >
          {editingRecord ? (
            <AttendanceCreateForm
              branches={branches}
              serviceTypes={serviceTypes}
              serviceSchedules={serviceSchedules}
              defaultBranchId={defaultBranchId}
              record={editingRecord}
              onSuccess={() => setEditingRecord(null)}
            />
          ) : null}
        </ModalShell>
      ) : null}
    </>
  );
}
