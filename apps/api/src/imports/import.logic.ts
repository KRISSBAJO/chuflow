import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
export const IMPORT_FIELDS = {
  guests: [
    'firstName',
    'lastName',
    'fullName',
    'title',
    'phone',
    'email',
    'gender',
    'dateOfBirth',
    'address',
    'city',
    'state',
    'zipCode',
    'maritalStatus',
    'invitedBy',
    'heardAboutChurch',
  ],
  members: [
    'firstName',
    'lastName',
    'fullName',
    'title',
    'phone',
    'email',
    'membershipStatus',
    'dateJoinedChurch',
    'familyDetails',
    'serviceGroups',
    'believerFoundationClassStatus',
    'believerFoundationClassDate',
    'believerFoundationClassLocation',
    'bccStatus',
    'bccDate',
    'bccLocation',
    'lccStatus',
    'lccDate',
    'lccLocation',
    'lcdStatus',
    'lcdDate',
    'lcdLocation',
    'holySpiritBaptismStatus',
    'waterBaptismStatus',
  ],
  service_units: ['name', 'meetingDay', 'prayerDay', 'notes'],
} as const;
export type ImportKind = keyof typeof IMPORT_FIELDS;
export function importCsvCell(value: unknown) {
  let text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (/^\s*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function checkValues(kind: ImportKind, value: Record<string, string>) {
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !(IMPORT_FIELDS[kind] as readonly string[]).includes(key),
    )
  )
    throw new Error('Unsupported spreadsheet fields.');
  if (
    Object.values(value).some(
      (v) => typeof v !== 'string' || v.length > 2000,
    ) ||
    JSON.stringify(value).length > 6500
  )
    throw new Error('A spreadsheet row is too long.');
}
export function recordId(batch: string, position: number) {
  return new Types.ObjectId(
    createHash('sha256')
      .update(`${batch}:${position}`)
      .digest('hex')
      .slice(0, 24),
  );
}
export function rowHash(sourceRow: number, values: Record<string, string>) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        sourceRow,
        Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
      ]),
    )
    .digest('hex');
}
export function identityKeys(row: Record<string, unknown>, kind: string) {
  const clean = (v: unknown) =>
    typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (kind === 'service_units') return ['group:' + clean(row.name)];
  const email = clean(row.email);
  const phone = clean(row.phone).replace(/\D/g, '');
  const firstName = clean(row.firstName);
  const lastName = clean(row.lastName);
  return [
    ...(email ? ['email:' + email] : []),
    ...(phone
      ? [
          'phone:' + phone,
          ...(phone.length > 10 ? ['phone:' + phone.slice(-10)] : []),
        ]
      : []),
    ...(firstName && lastName && (kind === 'guests' || (!email && !phone))
      ? ['name:' + firstName + ' ' + lastName]
      : []),
  ];
}
export function importDate(value: string, format: string) {
  let date = value.trim();
  if (format !== 'iso' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
    const [a, b, y] = date.split('/');
    date = `${y}-${(format === 'mdy' ? a : b).padStart(2, '0')}-${(format === 'mdy' ? b : a).padStart(2, '0')}`;
  }
  const d = new Date(date + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== date ||
    date > new Date().toISOString().slice(0, 10)
  )
    throw new Error(
      'Use a valid date that is not in the future, with the selected date format.',
    );
  return date;
}
export function normalizeImport(
  kind: ImportKind,
  values: Record<string, string>,
  dateFormat: string,
  groups: Map<string, string>,
) {
  checkValues(kind, values);
  const row: Record<string, unknown> = Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v),
  );
  if (kind === 'service_units') {
    if (!row.name || String(row.name).length > 120)
      throw new Error('Service group name is required (up to 120 characters).');
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    for (const key of ['meetingDay', 'prayerDay']) {
      const day = days.find(
        (d) => d.toLowerCase() === String(row[key] || '').toLowerCase(),
      );
      if (!day)
        throw new Error(
          'Meeting day and prayer day must be full weekday names.',
        );
      row[key] = day;
    }
    return { ...row, isActive: true };
  }
  if ((!row.firstName || !row.lastName) && row.fullName) {
    const name = String(row.fullName).split(/\s+/);
    row.firstName ||= name.shift();
    row.lastName ||= name.join(' ');
  }
  delete row.fullName;
  if (
    !row.firstName ||
    !row.lastName ||
    String(row.firstName).length > 100 ||
    String(row.lastName).length > 100
  )
    throw new Error(
      'First and last names are required (up to 100 characters each).',
    );
  if (
    row.phone &&
    (!/^[+\d()\s.\-]{5,50}$/.test(String(row.phone)) ||
      String(row.phone).replace(/\D/g, '').length < 7 ||
      String(row.phone).replace(/\D/g, '').length > 15)
  )
    throw new Error(
      'Use a phone number with 7–15 digits. Store phone columns as text.',
    );
  if (row.email) {
    row.email = String(row.email).toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email)) ||
      String(row.email).length > 254
    )
      throw new Error('Email address is invalid.');
  }
  if (row.title) {
    row.title = String(row.title).toLowerCase().replaceAll(' ', '_');
    if (
      ![
        'bro',
        'sister',
        'pastor',
        'resident_pastor',
        'associate_pastor',
        'deacon',
        'deaconess',
        'apostle',
        'other',
      ].includes(String(row.title))
    )
      throw new Error('Title is not recognized.');
  }
  for (const key of Object.keys(row)) {
    if (
      key.endsWith('Date') ||
      ['dateOfBirth', 'dateJoinedChurch'].includes(key)
    )
      row[key] = importDate(String(row[key]), dateFormat);
    if (
      (key.endsWith('Status') && key !== 'membershipStatus') ||
      key.endsWith('BaptismStatus')
    ) {
      const v = String(row[key]).toLowerCase();
      if (['yes', 'y', 'true', '1', 'completed', 'received'].includes(v))
        row[key] = 'yes';
      else if (['no', 'n', 'false', '0', 'not_started', 'not_yet'].includes(v))
        row[key] = 'no';
      else throw new Error(`${key}: use Yes or No.`);
    }
  }
  if (kind === 'guests')
    return {
      ...row,
      visitStatus: 'first_time',
      convertedToMember: false,
      children: [],
      wantsPastoralCall: false,
    };
  const status = String(row.membershipStatus || 'active')
    .toLowerCase()
    .replaceAll(' ', '_');
  if (!['active', 'inactive', 'new_member', 'worker'].includes(status))
    throw new Error(
      'Membership status must be Active, Inactive, New member or Worker.',
    );
  const names = String(row.serviceGroups || '')
    .split(/[;,|]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const ids = [
    ...new Set(
      names.map((n) => {
        const id = groups.get(n.toLowerCase());
        if (!id)
          throw new Error(
            `Unknown service group: ${n}. Import or create the group first.`,
          );
        return id;
      }),
    ),
  ];
  delete row.serviceGroups;
  return {
    ...row,
    membershipStatus: status,
    recordType: 'adult',
    ...(ids.length
      ? {
          serviceUnitIds: ids.map((id) => new Types.ObjectId(id)),
          serviceUnitId: new Types.ObjectId(ids[0]),
          serviceUnitInterest: names.join(', '),
        }
      : {}),
  };
}
