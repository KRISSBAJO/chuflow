export type ExportRow = Record<string, unknown>;
export type ExportCell = string | number | boolean | Date | null;
export type ExportColumn = {
  header: string;
  value: (row: ExportRow) => ExportCell;
  kind?: "date" | "money";
};
export type ExportDefinition = {
  title: string;
  permission: string;
  endpoint: string;
  filters: string[];
  columns: ExportColumn[];
  rowsPath?: string;
  paginated?: boolean;
  fixed?: Record<string, string>;
  branchLookup?: boolean;
  filterRows?: (
    rows: ExportRow[],
    query: Record<string, string>,
  ) => ExportRow[];
  extraSheets?: { title: string; path: string; columns: ExportColumn[] }[];
};
export function field(row: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === "object"
          ? (value as ExportRow)[key]
          : undefined,
      row,
    );
}
export function text(row: unknown, path: string) {
  const value = field(row, path);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
const person = (row: ExportRow, prefix = "") =>
  [text(row, prefix + "firstName"), text(row, prefix + "lastName")]
    .filter(Boolean)
    .join(" ");
const col = (
  header: string,
  path: string,
  kind?: "date" | "money",
): ExportColumn => ({
  header,
  kind,
  value: (row) => {
    const value = field(row, path);
    if (value === undefined || value === null) return null;
    if (kind === "date") {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date;
    }
    return typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? value
      : "";
  },
});
const branch: ExportColumn = {
  header: "Branch",
  value: (row) => text(row, "branchId.name") || text(row, "branch.name"),
};
const name: ExportColumn = { header: "Name", value: (row) => person(row) };
const owner: ExportColumn = {
  header: "Assigned to",
  value: (row) => person(row, "assignedTo."),
};
const commonFilters = ["branchId", "search", "sort"];
const scopeFilters = [
  "branchId",
  "oversightRegion",
  "district",
  "search",
  "status",
  "dateFrom",
  "dateTo",
];
const financeFilters = [...scopeFilters, "accountId", "offeringTypeId"];
const numbers = (keys: string[]) =>
  keys.map((key) =>
    col(
      key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase()),
      key,
    ),
  );
const attendanceColumns = [
  branch,
  col("Service date (UTC)", "serviceDate", "date"),
  col("Service", "serviceName"),
  col("Service type", "serviceType"),
  ...numbers([
    "menCount",
    "womenCount",
    "adultsCount",
    "childrenCount",
    "firstTimersCount",
    "newConvertsCount",
    "holySpiritBaptismCount",
  ]),
];
const groupColumns = [
  col("Group", "label"),
  col("Oversight region", "oversightRegion"),
  col("District", "district"),
  ...numbers([
    "reports",
    "currentAttendance",
    "previousAttendance",
    "growth",
    "growthPercent",
    "firstTimersCount",
    "newConvertsCount",
  ]),
];
const reportColumns = [
  branch,
  col("Status", "status"),
  col("Report week", "reportWeek"),
  ...numbers([
    "currentAttendance",
    "previousAttendance",
    "growth",
    "growthPercent",
    "firstTimersCount",
    "newConvertsCount",
    "believersFoundationClassCount",
    "holySpiritBaptismCount",
    "waterBaptismCount",
    "covenantHourOfPrayerAttendance",
    "winnersSatelliteFellowshipAverage",
    "cellCount",
    "newCellCount",
    "wofbiAttendance",
  ]),
  col("Remarks", "remarks"),
];
function arrayFilter(
  searchFields: string[],
  filters: Record<string, (row: ExportRow) => string>,
) {
  return (rows: ExportRow[], query: Record<string, string>) => {
    // Reuse directory filtering and ordering for the complete result, without its display pagination.
    const terms = (query.search || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const matching = rows.filter(
      (row) =>
        terms.every((term) =>
          searchFields
            .map((key) => text(row, key))
            .join(" ")
            .toLowerCase()
            .includes(term),
        ) &&
        Object.entries(filters).every(
          ([key, read]) => !query[key] || read(row) === query[key],
        ),
    );
    const sort = query.sort || "newest";
    const direction = sort === "newest" || sort === "name_desc" ? -1 : 1;
    return matching.sort((left, right) =>
      sort.startsWith("name_")
        ? direction *
            text(left, "name").localeCompare(text(right, "name"), "en", {
              sensitivity: "base",
              numeric: true,
            }) || text(left, "_id").localeCompare(text(right, "_id"))
        : direction * text(left, "_id").localeCompare(text(right, "_id")),
    );
  };
}

export const EXPORTS: Record<string, ExportDefinition> = {
  members: {
    title: "Members",
    permission: "/members",
    endpoint: "/members/directory",
    paginated: true,
    filters: [
      ...commonFilters,
      "status",
      "serviceUnitId",
      "foundation",
      "holySpirit",
    ],
    columns: [
      name,
      col("Phone", "phone"),
      col("Email", "email"),
      branch,
      col("Status", "membershipStatus"),
      {
        header: "Service groups",
        value: (row) =>
          Array.isArray(row.serviceUnitIds)
            ? row.serviceUnitIds
                .map((unit) => text(unit, "name"))
                .filter(Boolean)
                .join("; ")
            : text(row, "serviceUnitId.name") ||
              text(row, "serviceUnitInterest"),
      },
      col("Joined", "dateJoinedChurch"),
      col("Foundation class", "believerFoundationClassStatus"),
      col("Holy Spirit baptism", "holySpiritBaptismStatus"),
      col("Water baptism", "waterBaptismStatus"),
    ],
  },
  guests: {
    title: "Guests",
    permission: "/guests",
    endpoint: "/guests",
    paginated: true,
    filters: commonFilters,
    columns: [
      name,
      col("Phone", "phone"),
      col("Email", "email"),
      branch,
      col("Visit status", "visitStatus"),
      col("Follow-up status", "nextFollowUpStatus"),
      col("Registered (UTC)", "createdAt", "date"),
    ],
  },
  users: {
    title: "Users",
    permission: "/users",
    endpoint: "/users/directory",
    paginated: true,
    branchLookup: true,
    filters: [
      ...commonFilters,
      "role",
      "status",
      "oversightRegion",
      "district",
    ],
    columns: [
      name,
      col("Email", "email"),
      col("Role", "role"),
      branch,
      col("Oversight region", "oversightRegion"),
      col("District", "district"),
      col("Active", "isActive"),
      col("Last sign-in (UTC)", "lastLoginAt", "date"),
    ],
  },
  branches: {
    title: "Branches",
    permission: "/branches",
    endpoint: "/branches/overview",
    filters: ["search", "sort", "status", "district"],
    columns: [
      col("Name", "name"),
      col("Status", "status"),
      col("City", "city"),
      col("State", "state"),
      col("Country", "country"),
      col("District", "district"),
      col("Oversight region", "oversightRegion"),
      ...[
        "guestCount",
        "memberCount",
        "teamCount",
        "activeUserCount",
        "branchAdminCount",
      ].map((key) =>
        col(key.replace(/([a-z])([A-Z])/g, "$1 $2"), `metrics.${key}`),
      ),
    ],
    filterRows: arrayFilter(
      ["name", "city", "state", "country", "district", "oversightRegion"],
      {
        status: (row) => text(row, "status"),
        district: (row) => text(row, "district"),
      },
    ),
  },
  "service-units": {
    title: "Service units",
    permission: "/service-units",
    endpoint: "/service-units",
    filters: [...commonFilters, "status"],
    columns: [
      col("Name", "name"),
      branch,
      { header: "Leader", value: (row) => person(row, "leaderMemberId.") },
      {
        header: "Secretary",
        value: (row) => person(row, "secretaryMemberId."),
      },
      col("Members", "memberCount"),
      col("Meeting day", "meetingDay"),
      col("Prayer day", "prayerDay"),
      col("Active", "isActive"),
      col("Notes", "notes"),
    ],
    filterRows: arrayFilter(
      [
        "name",
        "meetingDay",
        "prayerDay",
        "notes",
        "leaderMemberId.firstName",
        "leaderMemberId.lastName",
      ],
      {
        status: (row) => (row.isActive ? "active" : "inactive"),
        branchId: (row) => text(row, "branchId._id") || text(row, "branchId"),
      },
    ),
  },
  templates: {
    title: "Intake templates",
    permission: "/templates",
    endpoint: "/intake-templates",
    branchLookup: true,
    filters: [...commonFilters, "status", "kind"],
    columns: [
      col("Name", "name"),
      col("Form type", "kind"),
      col("Title", "title"),
      branch,
      col("District", "district"),
      col("Oversight region", "oversightRegion"),
      col("Active", "isActive"),
      col("Public form path", "slug"),
    ],
    filterRows: arrayFilter(["name", "kind", "slug", "title"], {
      status: (row) => (row.isActive ? "active" : "inactive"),
      kind: (row) => text(row, "kind"),
      branchId: (row) =>
        text(row, "branchId._id") || text(row, "branchId") || "global",
    }),
  },
  "follow-up": {
    title: "Follow-up",
    permission: "/follow-up",
    endpoint: "/follow-ups",
    paginated: true,
    filters: scopeFilters,
    columns: [
      { header: "Guest", value: (row) => person(row, "guestId.") },
      { header: "Branch", value: (row) => text(row, "guestId.branchId.name") },
      col("Phone", "guestId.phone"),
      owner,
      col("Status", "status"),
      col("Contact method", "contactMethod"),
      col("Note", "note"),
      col("Next action (UTC)", "nextActionDate", "date"),
    ],
  },
  evangelism: {
    title: "Evangelism",
    permission: "/evangelism",
    endpoint: "/evangelism/contacts",
    paginated: true,
    filters: [...commonFilters, "stage", "queue"],
    columns: [
      name,
      branch,
      col("Phone", "phone"),
      col("Email", "email"),
      col("City", "city"),
      col("Progress", "stage"),
      owner,
      { header: "Reached by", value: (row) => person(row, "reachedBy.") },
      col("Preferred contact method", "preferredContactMethod"),
      col("Preferred time", "preferredContactTime"),
      col("Interest", "interest"),
      col("Permission to contact", "consentToContact"),
      col("Next action (UTC)", "nextActionDate", "date"),
      col("Received (UTC)", "createdAt", "date"),
    ],
  },
  "evangelism-links": {
    title: "Evangelism links",
    permission: "/evangelism",
    endpoint: "/evangelism/links?exportAll=true",
    filters: ["branchId"],
    columns: [
      col("Link name", "name"),
      col("Church name", "churchName"),
      branch,
      col("Type", "kind"),
      { header: "Owner", value: (row) => person(row, "ownerId.") },
      col("Active", "isActive"),
      col("Contacts received", "contactCount"),
    ],
  },
  attendance: {
    title: "Attendance summaries",
    permission: "/attendance",
    endpoint: "/attendance",
    filters: [],
    columns: attendanceColumns,
    filterRows: (rows) => rows.filter((row) => row.entryMode === "summary"),
  },
  "attendance-individual": {
    title: "Individual attendance",
    permission: "/attendance",
    endpoint: "/attendance",
    filters: [],
    columns: [
      branch,
      col("Service date (UTC)", "serviceDate", "date"),
      col("Service type", "serviceType"),
      col("Person type", "personType"),
      {
        header: "Person",
        value: (row) => person(row, "guestId.") || person(row, "memberId."),
      },
    ],
    filterRows: (rows) => rows.filter((row) => row.entryMode !== "summary"),
  },
  ledger: {
    title: "Finance ledger",
    permission: "/finance",
    endpoint: "/finance/ledger",
    paginated: true,
    filters: financeFilters,
    columns: [
      col("Entry date (UTC)", "entryDate", "date"),
      branch,
      col("Account", "accountLabel"),
      col("Direction", "direction"),
      col("Source", "sourceType"),
      col("Service", "serviceLabel"),
      col("Amount", "amount", "money"),
      col("Currency", "currency"),
      col("Description", "description"),
      col("Status", "status"),
    ],
  },
  offerings: {
    title: "Offerings",
    permission: "/finance",
    endpoint: "/finance/offerings",
    paginated: true,
    filters: financeFilters,
    columns: [
      col("Service date (UTC)", "serviceDate", "date"),
      branch,
      col("Service", "serviceLabel"),
      col("Service type", "serviceTypeLabel"),
      col("Offering type", "offeringTypeLabel"),
      col("Account", "accountId.name"),
      col("Amount", "amount", "money"),
      col("Currency", "currency"),
      col("Notes", "notes"),
    ],
  },
  expenses: {
    title: "Expenses",
    permission: "/finance",
    endpoint: "/finance/expenses",
    paginated: true,
    filters: financeFilters,
    columns: [
      col("Expense date (UTC)", "expenseDate", "date"),
      branch,
      col("Category", "expenseCategoryLabel"),
      col("Account", "accountLabel"),
      col("Payee", "payee"),
      col("Description", "description"),
      col("Amount", "amount", "money"),
      col("Currency", "currency"),
      col("Status", "status"),
      col("Review notes", "reviewNotes"),
    ],
  },
  communications: {
    title: "Communications",
    permission: "/communications",
    endpoint: "/communications/history",
    paginated: true,
    filters: [
      "branchId",
      "channel",
      "status",
      "templateName",
      "deliveryMode",
      "search",
    ],
    columns: [
      col("Sent (UTC)", "createdAt", "date"),
      branch,
      col("Recipient", "recipient"),
      col("Channel", "channel"),
      col("Template", "templateName"),
      col("Subject", "subject"),
      col("Message", "message"),
      col("Status", "status"),
      col("Delivery mode", "deliveryMode"),
      { header: "Sent by", value: (row) => person(row, "sentBy.") },
    ],
  },
  "weekly-reports": {
    title: "Weekly reports",
    permission: "/weekly-reports",
    endpoint: "/intake-templates/weekly-reports",
    filters: scopeFilters,
    columns: reportColumns,
    extraSheets: [
      { title: "Branch totals", path: "branchTotals", columns: groupColumns },
      {
        title: "District totals",
        path: "districtTotals",
        columns: groupColumns,
      },
      { title: "Trends", path: "trends", columns: groupColumns },
    ],
  },
  "maag-reports": {
    title: "MAAG reports",
    permission: "/maag-reports",
    endpoint: "/intake-templates/maag-reports",
    filters: [
      "branchId",
      "oversightRegion",
      "district",
      "status",
      "monthFrom",
      "monthTo",
    ],
    columns: [
      branch,
      col("Month", "reportMonth"),
      col("Status", "status"),
      col("Nation", "nation"),
      col("Station", "stationName"),
      col("Facility", "facilityType"),
      ...numbers([
        "mainHallCapacity",
        "servicesCount",
        "averageAttendance",
        "highestAttendance",
        "averageAdultAttendance",
        "averageChildrenAttendance",
        "incomeAmount",
        "rofAmount",
        "expenseAmount",
        "firstTimersCount",
        "newConvertsCount",
        "foundationClassCount",
        "holyGhostBaptismCount",
        "waterBaptismCount",
      ]),
    ],
    extraSheets: [
      { title: "Branch totals", path: "branchTotals", columns: groupColumns },
      {
        title: "District totals",
        path: "districtTotals",
        columns: groupColumns,
      },
    ],
  },
  "attendance-approvals": {
    title: "Attendance approvals",
    permission: "/approvals",
    endpoint: "/intake-templates/attendance-submissions",
    fixed: { status: "pending" },
    filters: [],
    columns: [col("Status", "status"), ...attendanceColumns],
  },
  "expense-approvals": {
    title: "Expense approvals",
    permission: "/approvals",
    endpoint: "/finance/expenses",
    paginated: true,
    fixed: { status: "submitted" },
    filters: [],
    columns: [],
  },
  "workspace-requests": {
    title: "Workspace requests",
    permission: "/approvals",
    endpoint: "/workspace-requests",
    paginated: true,
    filters: ["status", "search"],
    columns: [
      col("Church", "organizationName"),
      col("Contact", "contactName"),
      col("Email", "email"),
      col("Phone", "phone"),
      col("Status", "status"),
      col("Requested (UTC)", "createdAt", "date"),
    ],
  },
  "audit-logs": {
    title: "Audit logs",
    permission: "/approvals",
    endpoint: "/audit-logs",
    paginated: true,
    filters: ["entityType", "search", "branchId"],
    columns: [
      col("Recorded (UTC)", "createdAt", "date"),
      col("Action", "action"),
      col("Entity type", "entityType"),
      col("Description", "description"),
      { header: "Actor", value: (row) => person(row, "actorId.") },
      branch,
    ],
  },
  "service-types": {
    title: "Service types",
    permission: "/attendance",
    endpoint: "/service-types",
    filters: [],
    columns: [
      col("Name", "name"),
      branch,
      col("Description", "description"),
      col("Active", "isActive"),
    ],
  },
  "service-schedules": {
    title: "Service schedules",
    permission: "/attendance",
    endpoint: "/service-schedules",
    filters: [],
    columns: [
      col("Name", "name"),
      branch,
      col("Day", "dayOfWeek"),
      col("Start time", "startTime"),
      col("Service type", "serviceTypeId.name"),
      col("Active", "isActive"),
    ],
  },
};
EXPORTS["expense-approvals"].columns = EXPORTS.expenses.columns;
EXPORTS.ledger.extraSheets = [
  {
    title: "Balance by branch",
    path: "byBranch",
    columns: [
      col("Branch", "name"),
      col("District", "district"),
      col("Oversight region", "oversightRegion"),
      ...numbers(["totalCredits", "totalDebits", "balance"]),
    ],
  },
  {
    title: "Balance by account",
    path: "byAccount",
    columns: [
      col("Account", "label"),
      ...numbers(["totalCredits", "totalDebits", "balance"]),
    ],
  },
];
const maagTotals = [
  col("Group", "label"),
  col("District", "district"),
  col("Oversight region", "oversightRegion"),
  ...numbers([
    "reports",
    "servicesCount",
    "averageAttendance",
    "highestAttendance",
    "incomeAmount",
    "rofAmount",
    "expenseAmount",
    "firstTimersCount",
    "newConvertsCount",
  ]),
];
EXPORTS["maag-reports"].extraSheets = [
  { title: "Branch totals", path: "branchTotals", columns: maagTotals },
  { title: "District totals", path: "districtTotals", columns: maagTotals },
];
EXPORTS.reports = {
  title: "Reports",
  permission: "/reports",
  endpoint: "/reports/summary",
  filters: ["branchId", "days"],
  rowsPath: "trends",
  columns: [
    col("Date", "date"),
    ...numbers(["guests", "attendance", "firstTimers", "newConverts"]),
  ],
  extraSheets: [
    {
      title: "Summary",
      path: "totals",
      columns: numbers([
        "guestTotal",
        "memberTotal",
        "attendanceTotal",
        "firstTimersTotal",
        "newConvertsTotal",
        "summarySubmissionTotal",
        "adultsTotal",
        "childrenTotal",
        "conversionRate",
        "returnRate",
      ]),
    },
    {
      title: "Follow-up breakdown",
      path: "followUpBreakdown",
      columns: [col("Status", "_id"), col("Total", "total")],
    },
    {
      title: "Service mix",
      path: "serviceMix",
      columns: [
        col("Service", "_id"),
        ...numbers([
          "totalPeople",
          "firstTimers",
          "newConverts",
          "summarySubmissions",
          "individualCheckins",
        ]),
      ],
    },
  ],
};
for (const [id, endpoint, columns] of [
  [
    "finance-accounts",
    "/finance/accounts",
    [col("Name", "name"), col("Code", "key"), col("Active", "isActive")],
  ],
  [
    "offering-types",
    "/finance/offering-types",
    [col("Name", "name"), col("Code", "key"), col("Active", "isActive")],
  ],
  [
    "expense-categories",
    "/finance/expense-categories",
    [col("Name", "name"), col("Code", "key"), col("Active", "isActive")],
  ],
] as const)
  EXPORTS[id] = {
    title: id.replaceAll("-", " "),
    permission: "/finance",
    endpoint,
    filters: [],
    columns: [...columns],
  };
