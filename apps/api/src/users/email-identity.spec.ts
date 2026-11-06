/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { model } from 'mongoose';
import { normalizeUserEmail, userEmailPattern } from './email-identity';
import { UsersService } from './users.service';
import { UserSchema } from './schemas/user.schema';
const EmailUser = model('EmailIdentityTest', UserSchema);
function fixture(rows: Record<string, unknown>[]) {
  const query = {
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(rows),
  };
  const users = {
    find: jest.fn((filter: { email: RegExp }) => {
      void filter;
      return query;
    }),
    findOne: jest.fn((filter: { email: RegExp; _id?: { $ne: string } }) => {
      void filter;
      return { lean: jest.fn().mockResolvedValue(rows[0] || null) };
    }),
  };
  const service = new UsersService(
    users as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, users, query };
}
describe('Email account identity', () => {
  it('matches older mixed-case emails using either capitalization', async () => {
    const row = { email: 'Sample.Pastor@example.com', password: 'hash' };
    const f = fixture([row]);
    expect(
      await f.service.findByEmailWithPassword('sample.pastor@example.com'),
    ).toBe(row);
    expect(f.users.find.mock.calls[0][0].email.test(row.email)).toBe(true);
    expect(f.query.limit).toHaveBeenCalledWith(2);
  });
  it('trims input and treats dots and plus signs literally', () => {
    const pattern = userEmailPattern(' Pastor+Care@Example.com ');
    expect(pattern.test('PASTOR+CARE@example.COM')).toBe(true);
    expect(pattern.test('pastorcare@exampleXcom')).toBe(false);
    expect(pattern.test('otherpastor+care@example.com')).toBe(false);
    expect(normalizeUserEmail(' Pastor@Example.COM ')).toBe(
      'pastor@example.com',
    );
  });
  it('normalizes all newly saved addresses', () => {
    expect(new EmailUser({ email: ' Pastor@Example.COM ' }).email).toBe(
      'pastor@example.com',
    );
  });
  it('does not guess between conflicting legacy accounts', async () => {
    const f = fixture([
      { email: 'Pastor@example.com' },
      { email: 'pastor@example.com' },
    ]);
    expect(
      await f.service.findByEmailWithPassword('pastor@example.com'),
    ).toBeNull();
  });
  it('uses the same identity for password reset without returning password fields', async () => {
    const f = fixture([{ email: 'Pastor@example.com' }]);
    await f.service.findByEmail('PASTOR@example.com');
    expect(f.users.find.mock.calls[0][0].email.test('Pastor@example.com')).toBe(
      true,
    );
    expect(f.query.select).toHaveBeenCalledWith(
      '-password -passwordResetToken',
    );
  });
  it('rejects case-only duplicate registrations and excludes the current account when editing', async () => {
    const f = fixture([{ _id: 'another-account' }]);
    const available = (email: string, id?: string) =>
      (
        f.service as unknown as {
          ensureEmailAvailable: (email: string, id?: string) => Promise<void>;
        }
      ).ensureEmailAvailable(email, id);
    await expect(
      available('PASTOR@example.com', 'current-account'),
    ).rejects.toThrow('already exists');
    expect(f.users.findOne.mock.calls[0][0]).toEqual({
      email: expect.any(RegExp),
      _id: { $ne: 'current-account' },
    });
  });
});

describe('Password-only account edits', () => {
  it('saves and audits without requiring an email field or changing the address', async () => {
    const saved = {
      _id: 'target',
      firstName: 'Sample',
      lastName: 'Pastor',
      email: 'Saved@example.com',
      role: 'resident_pastor',
    };
    const users = {
      findByIdAndUpdate: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(saved),
      })),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(
      users as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
    );
    Object.assign(service, {
      ensureManageableTarget: jest.fn().mockResolvedValue(saved),
      resolveScopeForRole: jest.fn().mockResolvedValue({ branchId: 'church' }),
      ensureUniquePastoralBranchRole: jest.fn().mockResolvedValue(undefined),
    });
    await expect(
      service.update(
        { sub: 'admin', email: 'admin@example.com', role: 'super_admin' },
        'target',
        { password: 'Synthetic-Test-Only' },
      ),
    ).resolves.toBe(saved);
    const update = users.findByIdAndUpdate.mock.calls[0] as unknown as [
      string,
      { $set: Record<string, unknown> },
    ];
    expect(update[1].$set).not.toHaveProperty('email');
    expect(update[1].$set.password).not.toBe('Synthetic-Test-Only');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          passwordChanged: true,
          email: undefined,
        }),
      }),
    );
  });
});
