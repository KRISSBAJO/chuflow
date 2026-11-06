/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment -- Jest model doubles return promises; asymmetric matchers are intentionally untyped. */
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Types, Model } from 'mongoose';
import {
  PermissionsService,
  permissionScopeProfile,
  grantIsCurrent,
} from './permissions.service';
import { PermissionDelegationDocument } from './permission.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  additionalPermissionKeys,
  hasAdditionalPermission,
  delegatablePermissions,
} from '../common/permissions';
const A = '600000000000000000000001',
  B = '600000000000000000000002',
  CHURCH = '600000000000000000000003',
  OTHER = '600000000000000000000004';
const leader: AuthUser = {
  sub: A,
  email: 'leader@example.com',
  role: 'resident_pastor',
  branchId: CHURCH,
};
function fixture() {
  const recipient = {
    _id: new Types.ObjectId(B),
    firstName: 'Reader',
    lastName: 'User',
    email: 'reader@example.com',
    role: 'follow_up',
    branchId: new Types.ObjectId(CHURCH),
    isActive: true,
    permissionRevision: 0,
  };
  const users = {
    findById: jest.fn(() => ({
      select: () => ({ lean: async () => recipient }),
    })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const grants = {
    find: jest.fn(() => ({
      lean: async () => [] as Record<string, unknown>[],
    })),
    findById: jest.fn(() => ({
      lean: async () => null as Record<string, unknown> | null,
    })),
    updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    create: jest.fn(async () => []),
    db: {
      transaction: jest.fn(async (fn: (session: unknown) => Promise<void>) =>
        fn({}),
      ),
    },
  };
  const scopes = {
    getAccessibleBranchIds: jest.fn(async (user: AuthUser) =>
      user.role === 'super_admin' ? null : [CHURCH],
    ),
  };
  const service = new PermissionsService(
    users as unknown as Model<UserDocument>,
    grants as unknown as Model<PermissionDelegationDocument>,
    scopes as unknown as AccessScopeService,
  );
  return { service, users, grants, scopes, recipient };
}
describe('delegated permission boundaries and lifecycle', () => {
  it('grants bounded church access without changing the recipient role or church', async () => {
    const { service, grants, recipient } = fixture();
    await service.grant(leader, {
      recipientId: B,
      permissions: ['members.view'],
      expectedRevision: 0,
      reason: 'Help maintain our register',
    });
    expect(grants.db.transaction).toHaveBeenCalledTimes(1);
    expect(grants.create.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientId: recipient._id,
          permission: 'members.view',
          scopeBranchIds: [CHURCH],
          scopeProfile: permissionScopeProfile(recipient),
        }),
      ]),
    );
    expect(recipient.role).toBe('follow_up');
    expect(String(recipient.branchId)).toBe(CHURCH);
  });
  it('refuses self grants and higher-ranked targets', async () => {
    const { service, recipient, grants } = fixture();
    recipient._id = new Types.ObjectId(A);
    await expect(
      service.grant(leader, {
        recipientId: A,
        permissions: ['members.view'],
        expectedRevision: 0,
        reason: 'Self grant',
      }),
    ).rejects.toThrow(ForbiddenException);
    recipient._id = new Types.ObjectId(B);
    recipient.role = 'national_admin';
    await expect(service.detail(leader, B)).rejects.toThrow(ForbiddenException);
    expect(grants.create).not.toHaveBeenCalled();
  });
  it('blocks an otherwise local recipient with wider oversight', async () => {
    const { service, scopes } = fixture();
    scopes.getAccessibleBranchIds.mockImplementation(async (user) =>
      user.sub === A ? [CHURCH] : [CHURCH, OTHER],
    );
    await expect(
      service.grant(leader, {
        recipientId: B,
        permissions: ['members.view'],
        expectedRevision: 0,
        reason: 'Out of scope',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('blocks feature recipients from delegating and unknown management capabilities', async () => {
    const { service } = fixture();
    await expect(
      service.detail(
        {
          ...leader,
          role: 'follow_up',
          additionalPermissions: ['members.edit'],
        },
        B,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.grant(leader, {
        recipientId: B,
        permissions: ['users.admin'],
        expectedRevision: 0,
        reason: 'Unsupported',
      }),
    ).rejects.toThrow();
    expect(
      delegatablePermissions({
        role: 'follow_up',
        additionalPermissions: ['members.edit'],
      }),
    ).toEqual([]);
  });
  it('enforces timed authority when a manager passes on an extra permission', async () => {
    const { service } = fixture();
    const maximum = new Date(Date.now() + 86400000).toISOString();
    const actor = {
      ...leader,
      role: 'branch_admin' as const,
      additionalPermissions: ['finance.offerings'],
      additionalPermissionExpiries: { 'finance.offerings': maximum },
    };
    await expect(
      service.grant(actor, {
        recipientId: B,
        permissions: ['finance.offerings'],
        expectedRevision: 0,
        reason: 'Temporary finance cover',
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.grant(actor, {
        recipientId: B,
        permissions: ['finance.offerings'],
        expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        expectedRevision: 0,
        reason: 'Temporary finance cover',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rejects stale concurrent updates before creating grants', async () => {
    const { service, users, grants } = fixture();
    users.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      service.grant(leader, {
        recipientId: B,
        permissions: ['members.view'],
        expectedRevision: 3,
        reason: 'Concurrent update',
      }),
    ).rejects.toThrow(ConflictException);
    expect(grants.create).not.toHaveBeenCalled();
  });
  it('rejects expired dates and whitespace reasons', async () => {
    const { service } = fixture();
    await expect(
      service.grant(leader, {
        recipientId: B,
        permissions: ['members.view'],
        expiresAt: '2020-01-01T00:00:00Z',
        expectedRevision: 0,
        reason: 'Expired',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.grant(leader, {
        recipientId: B,
        permissions: ['members.view'],
        expectedRevision: 0,
        reason: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });
  it('preserves revocation history instead of deleting rows', async () => {
    const { service, grants, recipient } = fixture();
    grants.findById.mockReturnValue({
      lean: async () => ({
        _id: new Types.ObjectId(OTHER),
        recipientId: recipient._id,
        status: 'active',
      }),
    });
    await service.revoke(leader, OTHER, {
      expectedRevision: 0,
      reason: 'Duty has ended',
    });
    expect(grants.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'revoked',
          revocationReason: 'Duty has ended',
          revokedByUserId: new Types.ObjectId(A),
        }),
      }),
      expect.anything(),
    );
  });
  it('revokes all extras atomically while retaining role permissions', async () => {
    const { service, grants } = fixture();
    await service.revokeAll(leader, B, {
      expectedRevision: 0,
      reason: 'Duties reassigned',
    });
    expect(grants.updateMany).toHaveBeenCalledWith(
      { recipientId: new Types.ObjectId(B), status: 'active' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'revoked' }),
      }),
      expect.anything(),
    );
  });
  it('resolves fresh unexpired grants and pauses extras after role or church changes', async () => {
    const { service, grants, recipient } = fixture();
    const grant = {
      permission: 'members.edit',
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000),
      scopeProfile: permissionScopeProfile(recipient),
      scopeBranchIds: [CHURCH],
    };
    grants.find.mockReturnValue({ lean: async () => [grant] });
    expect((await service.resolve(recipient)).additionalPermissions).toEqual(
      expect.arrayContaining(['members.edit', 'members.view']),
    );
    recipient.role = 'usher';
    expect((await service.resolve(recipient)).additionalPermissions).toEqual(
      [],
    );
  });
  it('scope expansion, expiration and revocation fail closed', () => {
    const { recipient } = fixture();
    const grant = {
      status: 'active',
      expiresAt: new Date(Date.now() + 10000),
      scopeProfile: permissionScopeProfile(recipient),
      scopeBranchIds: [CHURCH],
    };
    expect(grantIsCurrent(grant, recipient, [CHURCH])).toBe(true);
    expect(grantIsCurrent(grant, recipient, [CHURCH, OTHER])).toBe(false);
    expect(grantIsCurrent(grant, recipient, null)).toBe(false);
    expect(
      grantIsCurrent({ ...grant, status: 'revoked' }, recipient, [CHURCH]),
    ).toBe(false);
    expect(grantIsCurrent(grant, recipient, [CHURCH], Date.now() + 20000)).toBe(
      false,
    );
  });
  it('includes prerequisites but ignores unknown or expired feature grants', () => {
    expect(
      additionalPermissionKeys({
        additionalPermissions: ['members.edit', 'users.admin'],
      }),
    ).toEqual(['members.edit', 'members.view']);
    expect(
      hasAdditionalPermission(
        {
          additionalPermissions: ['members.edit'],
          additionalPermissionExpiries: {
            'members.edit': '2020-01-01T00:00:00Z',
          },
        },
        'members.view',
      ),
    ).toBe(false);
  });
});
