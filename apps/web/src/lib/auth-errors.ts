/** Never expose server bodies, stack traces or account-existence details at sign-in. */
export function loginErrorKey(status: number) {
  if (status === 401) return "incorrect";
  if (status === 403) return "restricted";
  if (status === 429) return "tooManyAttempts";
  if (status === 400 || status === 422) return "checkDetails";
  if (status >= 500) return "unavailable";
  return "failed";
}
