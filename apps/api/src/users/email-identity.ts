/** Canonical writes plus literal case-insensitive matching for older accounts. */
export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}
export function userEmailPattern(email: string) {
  const literal = normalizeUserEmail(email).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return new RegExp(`^${literal}$`, 'i');
}
