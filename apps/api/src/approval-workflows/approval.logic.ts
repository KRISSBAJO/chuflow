import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  LEVELS,
  type ApprovalLevel,
  type ApprovalStage,
} from './approval.schema';
export function finalApprovalLevel(
  policy: {
    finalLevel: ApprovalLevel;
    thresholdAmount?: number;
    aboveThresholdLevel?: ApprovalLevel;
  },
  amount?: number,
) {
  if (
    policy.thresholdAmount !== undefined &&
    (typeof amount !== 'number' || !Number.isFinite(amount))
  )
    throw new BadRequestException('An amount is required for this route.');
  return policy.thresholdAmount !== undefined &&
    amount! > policy.thresholdAmount
    ? policy.aboveThresholdLevel!
    : policy.finalLevel;
}
export function validatePolicyLevels(
  finalLevel: ApprovalLevel,
  threshold?: number,
  higher?: ApprovalLevel,
) {
  if (
    threshold !== undefined &&
    (!higher || LEVELS.indexOf(higher) <= LEVELS.indexOf(finalLevel))
  )
    throw new BadRequestException(
      'The amount-based final level must be higher than the normal final level.',
    );
}
export function validateStages(
  stages: ApprovalStage[],
  finalLevel: ApprovalLevel,
) {
  if (!stages.length || stages.at(-1)?.level !== finalLevel)
    throw new BadRequestException(
      `This church has no ${finalLevel} level. Set its placement before submitting.`,
    );
  for (const stage of stages)
    if (!stage.reviewerIds.length)
      throw new BadRequestException(
        `No eligible reviewer at ${stage.label}. Appoint an active pastor or an alternate local reviewer; requesters cannot approve their own requests.`,
      );
  return stages;
}
export function ensureDecisionAllowed(
  request: {
    status: string;
    requesterId: string;
    currentReviewerIds: string[];
  },
  userId: string,
) {
  if (request.status !== 'pending')
    throw new BadRequestException('This request is not awaiting review.');
  if (
    request.requesterId === userId ||
    !request.currentReviewerIds.includes(userId)
  )
    throw new ForbiddenException(
      'Only the assigned reviewer can decide. You cannot review your own request.',
    );
}
export function nextApprovalState(stages: ApprovalStage[], current: number) {
  const next = current + 1;
  return next < stages.length
    ? {
        status: 'pending',
        currentStage: next,
        currentReviewerIds: stages[next].reviewerIds,
      }
    : { status: 'approved', currentStage: current, currentReviewerIds: [] };
}
