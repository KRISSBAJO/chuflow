import { ConflictException, ForbiddenException } from '@nestjs/common';

export function financeActorId(value: unknown): string {
  if (value && typeof value === 'object' && '_id' in value)
    return String(value._id);
  return value == null ? '' : String(value);
}

export function ensureIndependentReview(
  entry: {
    createdBy?: unknown;
    updatedBy?: unknown;
    status?: string;
    reviewRevision?: number;
  },
  reviewerId: string,
  revision?: number,
) {
  if (entry.status !== 'submitted')
    throw new ConflictException(
      'Only pending finance entries can be reviewed. Refresh the record.',
    );
  if (
    [financeActorId(entry.createdBy), financeActorId(entry.updatedBy)].includes(
      reviewerId,
    )
  ) {
    throw new ForbiddenException(
      'A different authorized person must review this entry. You cannot approve or reject an entry you created or edited.',
    );
  }
  if (revision !== undefined && revision !== (entry.reviewRevision ?? 0)) {
    throw new ConflictException(
      'This entry changed after you opened it. Refresh and review the latest figures.',
    );
  }
}

export const SETTLED_FINANCE_STATUSES = ['approved', 'locked'];
