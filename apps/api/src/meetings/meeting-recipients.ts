import { isEmail } from 'class-validator';
export type EmailPerson = { _id: unknown; email?: string };
export function normalizeMeetingEmail(email?: string) {
  const value = email?.trim().toLowerCase();
  return value && isEmail(value) ? value : null;
}
export function meetingRecipients(
  members: EmailPerson[],
  users: EmailPerson[],
) {
  const unique = new Map<
    string,
    { email: string; memberIds: string[]; userIds: string[] }
  >();
  let missingEmail = 0;
  for (const [people, key] of [
    [members, 'memberIds'],
    [users, 'userIds'],
  ] as const)
    for (const person of people) {
      const email = normalizeMeetingEmail(person.email);
      if (!email) {
        missingEmail++;
        continue;
      }
      const row = unique.get(email) || { email, memberIds: [], userIds: [] };
      if (!row[key].includes(String(person._id)))
        row[key].push(String(person._id));
      unique.set(email, row);
    }
  return { recipients: [...unique.values()], missingEmail };
}
export function serviceAudienceFilter(branchId: string, ids: string[]) {
  return {
    branchId,
    $or: [
      { serviceUnitIds: { $in: ids } },
      { serviceUnitIds: { $exists: false }, serviceUnitId: { $in: ids } },
    ],
  };
}
