import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ensureIndependentReview } from './finance-review';

describe('independent finance review', () => {
  const creator = new Types.ObjectId();
  const editor = new Types.ObjectId();
  const reviewer = new Types.ObjectId();
  const entry = {
    createdBy: creator,
    updatedBy: { _id: editor },
    status: 'submitted',
    reviewRevision: 4,
  };
  it('prevents both the author and last editor from approving or rejecting', () => {
    expect(() => ensureIndependentReview(entry, String(creator), 4)).toThrow(
      ForbiddenException,
    );
    expect(() => ensureIndependentReview(entry, String(editor), 4)).toThrow(
      ForbiddenException,
    );
  });
  it('requires a pending entry and the version the reviewer actually saw', () => {
    expect(() =>
      ensureIndependentReview(
        { ...entry, status: 'approved' },
        String(reviewer),
        4,
      ),
    ).toThrow(ConflictException);
    expect(() => ensureIndependentReview(entry, String(reviewer), 3)).toThrow(
      ConflictException,
    );
    expect(() =>
      ensureIndependentReview(entry, String(reviewer), 4),
    ).not.toThrow();
  });
});
