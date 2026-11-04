"use client";

import { useMemo, useState } from "react";
import { ExportTableButtons } from "@/components/table-export";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { ModalShell } from "@/components/modal-shell";
import { Badge, Button, EmptyState, TableWrap } from "@/components/ui/ui";
import type {
  AttendanceItem,
  BranchSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

const NUMBER_COLUMNS = [
  "Men",
  "Women",
  "Children",
  "Adults",
  "First timers",
  "New converts",
  "Holy Spirit",
];

function getBranchId(value: AttendanceItem["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getBranchName(
  value: AttendanceItem["branchId"],
  branches: BranchSummary[],
) {
  if (typeof value === "string") {
    return branches.find((branch) => branch._id === value)?.name || "Branch";
  }

  if (value?.name) {
    return value.name;
  }

  if (value?._id) {
    return (
      branches.find((branch) => branch._id === value._id)?.name || "Branch"
    );
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
  const [sort, setSort] = useState("newest");
  const [pageSize, setPageSize] = useState(25);
  const [editingRecord, setEditingRecord] = useState<AttendanceItem | null>(
    null,
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...records]
      .filter((record) => {
        const branchId = getBranchId(record.branchId);
        const serviceDate = record.serviceDate.slice(0, 10);
        const serviceLabel =
          `${record.serviceName || ""} ${record.serviceTypeLabel || ""} ${record.serviceType || ""}`.toLowerCase();

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
      .sort(
        (left, right) =>
          (sort === "oldest" ? 1 : -1) *
            (new Date(left.serviceDate).getTime() -
              new Date(right.serviceDate).getTime()) ||
          left._id.localeCompare(right._id),
      );
  }, [
    branchFilter,
    dateFrom,
    dateTo,
    records,
    search,
    serviceTypeFilter,
    sort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <>
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search service name or type"
            aria-label="Search service summaries"
            className="ui-input sm:col-span-2 lg:col-span-1"
          />
          <select
            value={branchFilter}
            onChange={(event) => {
              setBranchFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Branch"
            className="ui-input"
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
            aria-label="Service type"
            className="ui-input"
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
            aria-label="From date"
            className="ui-input"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="ui-input"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-[#6b6b6b]">
            Sort
            <select
              className="ui-input mt-1"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest service first</option>
              <option value="oldest">Oldest service first</option>
            </select>
          </label>
          <label className="text-xs text-[#6b6b6b]">
            Per page
            <select
              className="ui-input mt-1"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setBranchFilter(defaultBranchId || "");
              setServiceTypeFilter("");
              setDateFrom("");
              setDateTo("");
              setSort("newest");
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        </div>
        <ExportTableButtons
          resource="attendance"
          rows={filteredRecords}
          label="Download filtered summaries"
        />
        {filteredRecords.length === 0 ? (
          <EmptyState icon="attendance" title="No summaries found">
            No service summaries match the current filters.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className="ui-table min-w-[1120px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Service</th>
                  <th>Type</th>
                  {NUMBER_COLUMNS.map((column) => (
                    <th key={column} className="text-right">
                      {column}
                    </th>
                  ))}
                  {canEdit ? (
                    <th className="text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record._id}>
                    <td className="whitespace-nowrap text-[#55534e]">
                      {new Date(record.serviceDate).toLocaleString()}
                    </td>
                    <td className="text-[#55534e]">
                      {getBranchName(record.branchId, branches)}
                    </td>
                    <td className="font-medium">
                      {record.serviceName || "Not named"}
                    </td>
                    <td>
                      <Badge>
                        {record.serviceTypeLabel || record.serviceType}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">
                      {record.menCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.womenCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.childrenCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.adultsCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.firstTimersCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.newConvertsCount ?? 0}
                    </td>
                    <td className="text-right tabular-nums">
                      {record.holySpiritBaptismCount ?? 0}
                    </td>
                    {canEdit ? (
                      <td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingRecord(record)}
                        >
                          Edit
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#8a8780]">
            {filteredRecords.length > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium tabular-nums text-[#111111]">
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filteredRecords.length)}
                </span>{" "}
                of{" "}
                <span className="tabular-nums">{filteredRecords.length}</span>
              </>
            ) : (
              "No summaries found"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <span className="text-[13px] text-[#8a8780]">
              Page{" "}
              <span className="font-medium tabular-nums text-[#111111]">
                {safePage}
              </span>{" "}
              of <span className="tabular-nums">{totalPages}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {canEdit ? (
        <ModalShell
          open={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          eyebrow="Attendance"
          title="Edit service summary"
          description="Adjust the recorded totals, service type or service details for this summary."
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
