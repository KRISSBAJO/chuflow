/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
import { recordId } from './import.logic';
import { ImportService } from './import.service';
import { Types } from 'mongoose';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
const branch = new Types.ObjectId(),
  id = new Types.ObjectId();
const user: AuthUser = {
  sub: 'actor',
  email: 'actor@example.com',
  role: 'branch_admin',
  branchId: String(branch),
};
const query = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
});
function fixture() {
  const job = {
    _id: id,
    kind: 'members',
    branchId: branch,
    status: 'uploading',
    expectedRows: 1,
    valid: 1,
    dateFormat: 'iso',
    expiresAt: new Date(Date.now() + 86400000),
  };
  const batches = {
    findById: jest.fn(() => query(job)),
    updateOne: jest
      .fn()
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  };
  const rows = {
    find: jest.fn(() => query([])),
    bulkWrite: jest.fn().mockResolvedValue({}),
    countDocuments: jest.fn().mockResolvedValue(1),
  };
  const scope = { ensureBranchAccess: jest.fn().mockResolvedValue(undefined) };
  const branches = { exists: jest.fn().mockResolvedValue(true) };
  const service = new ImportService(
    batches as any,
    rows as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    branches as any,
    scope as any,
    {} as any,
  );
  return { service, job, batches, rows, scope, branches };
}
describe('Import safety boundaries', () => {
  it('denies non-leadership before reading stored personal information', async () => {
    const f = fixture();
    await expect(
      f.service.detail({ ...user, role: 'usher' }, String(id)),
    ).rejects.toThrow('leadership');
    expect(f.batches.findById).not.toHaveBeenCalled();
  });
  it('checks church scope before accepting rows', async () => {
    const f = fixture();
    f.scope.ensureBranchAccess.mockRejectedValue(new Error('denied'));
    await expect(
      f.service.upload(user, String(id), {
        offset: 0,
        rows: [{ sourceRow: 2, values: { firstName: 'Sample' } }],
      }),
    ).rejects.toThrow('denied');
    expect(f.rows.bulkWrite).not.toHaveBeenCalled();
  });
  it('rejects expired jobs even before scope access', async () => {
    const f = fixture();
    f.job.expiresAt = new Date(0);
    await expect(f.service.detail(user, String(id))).rejects.toThrow(
      'retention',
    );
    expect(f.scope.ensureBranchAccess).not.toHaveBeenCalled();
  });
  it('rejects altered row retries without overwriting the original', async () => {
    const f = fixture();
    f.rows.find.mockReturnValue(
      query([{ _id: recordId(String(id), 0), hash: 'original' }]),
    );
    await expect(
      f.service.upload(user, String(id), {
        offset: 0,
        rows: [{ sourceRow: 2, values: { firstName: 'Changed' } }],
      }),
    ).rejects.toThrow('changed');
    expect(f.rows.bulkWrite).not.toHaveBeenCalled();
  });
  it('uses immutable insert-only upload operations for safe retries', async () => {
    const f = fixture();
    await f.service.upload(user, String(id), {
      offset: 0,
      rows: [{ sourceRow: 2, values: { firstName: 'Sample' } }],
    });
    expect(f.rows.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $setOnInsert: expect.objectContaining({
              values: { firstName: 'Sample' },
              status: 'uploaded',
            }),
          },
          upsert: true,
        }),
      }),
    ]);
  });
  it('requires the reviewed church and count before committing', async () => {
    const f = fixture();
    await expect(
      f.service.commit(user, String(id), {
        branchId: String(new Types.ObjectId()),
        expectedValid: 1,
      }),
    ).rejects.toThrow('Review');
    await expect(
      f.service.commit(user, String(id), {
        branchId: String(branch),
        expectedValid: 9,
      }),
    ).rejects.toThrow('Review');
    expect(f.batches.updateOne).not.toHaveBeenCalled();
  });
  it('blocks imports to inactive churches', async () => {
    const f = fixture();
    f.branches.exists.mockResolvedValue(false);
    await expect(f.service.detail(user, String(id))).rejects.toThrow(
      'active church',
    );
  });
});
