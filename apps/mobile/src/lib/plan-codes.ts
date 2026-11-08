/* The 402 codes the API sends when the church's plan, not the person's role, refuses a request. */

export const PLAN_ERROR_CODES = ['feature_locked', 'quota_exceeded', 'workspace_read_only', 'workspace_locked', 'workspace_suspended'] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export function isPlanErrorCode(value: unknown): value is PlanErrorCode {
  return typeof value === 'string' && (PLAN_ERROR_CODES as readonly string[]).includes(value);
}
