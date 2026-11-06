/** Explicit handler allow-list: a feature grant never unlocks arbitrary admin endpoints. */
export const PERMISSION_ENDPOINTS: Record<string, Record<string, string>> = {
  members: {
    list: 'members.view',
    directory: 'members.view',
    findOne: 'members.view',
    create: 'members.create',
    convert: 'members.create',
    update: 'members.edit',
  },
  visits: { list: 'guests.view' },
  guests: {
    list: 'guests.view',
    findOne: 'guests.view',
    duplicates: 'guests.view',
    create: 'guests.create',
    update: 'guests.edit',
  },
  attendance: {
    list: 'attendance.view',
    summary: 'attendance.view',
    detail: 'attendance.view',
    create: 'attendance.create',
    update: 'attendance.edit',
  },
  'service-units': {
    list: 'service_units.view',
    findOne: 'service_units.view',
    create: 'service_units.create',
    update: 'service_units.edit',
  },
  finance: {
    listAccounts: 'finance.view',
    listExpenseCategories: 'finance.view',
    listOfferingTypes: 'finance.view',
    listOfferings: 'finance.view',
    listExpenses: 'finance.view',
    findExpense: 'finance.view',
    findOffering: 'finance.view',
    listLedger: 'finance.view',
    listLocks: 'finance.view',
    createOffering: 'finance.offerings',
    createExpense: 'finance.expenses',
    approveExpense: 'finance.approve',
    rejectExpense: 'finance.approve',
    createLock: 'finance.locks',
    removeLock: 'finance.locks',
  },
  reports: {
    dashboard: 'reports.view',
    summary: 'reports.view',
    exportCsv: 'reports.view',
  },
  'intake-templates': {
    listWeeklyReports: 'reports.view',
    weeklyReportDetail: 'reports.view',
    exportWeeklyReportsCsv: 'reports.view',
    listMaagReports: 'reports.view',
    exportMaagReportsCsv: 'reports.view',
  },
  communications: {
    listTemplates: 'communications.view',
    listHistory: 'communications.view',
    send: 'communications.send',
  },
  'follow-ups': {
    list: 'follow_up.view',
    findOne: 'follow_up.view',
    create: 'follow_up.create',
    update: 'follow_up.edit',
  },
};
export function endpointPermission(
  controller: unknown,
  handler: string,
): string | undefined {
  return typeof controller === 'string'
    ? PERMISSION_ENDPOINTS[controller]?.[handler]
    : undefined;
}
export function isPermissionLookup(
  controller: unknown,
  handler: string,
  keys: readonly string[],
) {
  if (typeof controller !== 'string' || !keys.length) return false;
  if (controller === 'branches' && ['findAll', 'options'].includes(handler))
    return true;
  if (controller === 'users' && handler === 'assignmentOptions')
    return keys.some(
      (key) => key.startsWith('guests.') || key.startsWith('follow_up.'),
    );
  if (controller === 'service-units' && handler === 'list')
    return keys.some((key) => key.startsWith('members.'));
  if (
    ['service-types', 'service-schedules'].includes(controller) &&
    handler === 'list'
  )
    return keys.some((key) =>
      ['finance.', 'attendance.', 'guests.'].some((prefix) =>
        key.startsWith(prefix),
      ),
    );
  return false;
}
