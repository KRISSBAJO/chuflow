import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { AccessScopeService } from '../access-scope/access-scope.service';

import { User, UserDocument } from '../users/schemas/user.schema';

import { AuthUser } from '../common/interfaces/auth-user.interface';

import {
  additionalPermissionKeys,
  canDelegatePermissions,
  delegatablePermissions,
  isPermissionKey,
  PERMISSION_CATALOG,
  rolePermissionKeys,
} from '../common/permissions';

import {
  PermissionDelegation,
  PermissionDelegationDocument,
} from './permission.schema';

import { GrantPermissionsDto, RevokePermissionDto } from './permission.dto';

const ranks: Record<string, number> = {
  super_admin: 100,
  national_admin: 80,
  national_pastor: 80,
  district_admin: 60,
  district_pastor: 60,
  branch_admin: 40,
  resident_pastor: 40,
  associate_pastor: 30,
  follow_up: 10,
  usher: 10,
  children_worker: 10,
  children_supervisor: 10,
};

type Person = {
  _id: Types.ObjectId | string;
  role: string;
  firstName?: string;
  lastName?: string;
  branchId?: Types.ObjectId | string;
  oversightRegion?: string;
  district?: string;
  isActive?: boolean;
  permissionRevision?: number;
};

export function permissionScopeProfile(user: Person) {
  return JSON.stringify([
    user.role,
    String(user.branchId || ''),
    user.oversightRegion || '',
    user.district || '',
  ]);
}

export function permissionSubject(user: Person): AuthUser {
  return {
    sub: String(user._id),
    role: user.role as AuthUser['role'],
    email: '',
    branchId: user.branchId ? String(user.branchId) : undefined,
    oversightRegion: user.oversightRegion,
    district: user.district,
  };
}

export function grantIsCurrent(
  grant: Pick<
    PermissionDelegation,
    'status' | 'expiresAt' | 'scopeProfile' | 'scopeBranchIds'
  >,
  user: Person,
  branches: string[] | null,
  now = Date.now(),
) {
  return (
    grant.status === 'active' &&
    (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now) &&
    grant.scopeProfile === permissionScopeProfile(user) &&
    branches !== null &&
    branches.every((id) => grant.scopeBranchIds.includes(id))
  );
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(PermissionDelegation.name)
    private readonly grants: Model<PermissionDelegationDocument>,
    private readonly scopes: AccessScopeService,
  ) {}

  private manager(actor: AuthUser) {
    if (!canDelegatePermissions(actor.role))
      throw new ForbiddenException('You cannot manage additional permissions.');
  }

  private id(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid user or permission identifier.');
    return new Types.ObjectId(id);
  }

  private async person(id: string) {
    const user = await this.users
      .findById(this.id(id))
      .select(
        'firstName lastName email role branchId oversightRegion district isActive permissionRevision',
      )
      .lean();
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async manageable(actor: AuthUser, target: Person, writing = false) {
    this.manager(actor);

    if (writing && actor.sub === String(target._id))
      throw new ForbiddenException(
        'You cannot change your own additional permissions.',
      );

    if ((ranks[target.role] ?? 1000) > (ranks[actor.role] ?? 0))
      throw new ForbiddenException(
        'This user is outside your management authority.',
      );

    if (actor.role === 'super_admin') return;

    const [own, theirs] = await Promise.all([
      this.scopes.getAccessibleBranchIds(actor),
      this.scopes.getAccessibleBranchIds(permissionSubject(target)),
    ]);

    if (
      !own?.length ||
      !theirs?.length ||
      !theirs.every((id) => own.includes(id))
    )
      throw new ForbiddenException(
        'This user has access to churches outside your management scope.',
      );
  }

  async resolve(user: Person) {
    const active = await this.grants
      .find({
        recipientId: this.id(String(user._id)),
        status: 'active',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
      .lean();

    const expiries: Record<string, string | null> = {};

    if (!active.length || user.isActive === false)
      return {
        additionalPermissions: [] as string[],
        additionalPermissionExpiries: expiries,
      };

    const branches = await this.scopes.getAccessibleBranchIds(
      permissionSubject(user),
    );

    for (const grant of active) {
      if (
        !isPermissionKey(grant.permission) ||
        !grantIsCurrent(grant, user, branches)
      )
        continue;

      for (const key of additionalPermissionKeys({
        additionalPermissions: [grant.permission],
      })) {
        const expiry = grant.expiresAt?.toISOString() ?? null;

        if (
          !(key in expiries) ||
          expiry === null ||
          (expiries[key] !== null && expiry > expiries[key])
        )
          expiries[key] = expiry;
      }
    }

    return {
      additionalPermissions: Object.keys(expiries),
      additionalPermissionExpiries: expiries,
    };
  }

  async detail(actor: AuthUser, id: string) {
    const target = await this.person(id);
    await this.manageable(actor, target);

    const extras = await this.resolve(target);

    return {
      user: target,
      ...extras,
      basePermissions: rolePermissionKeys(target.role),
      catalog: PERMISSION_CATALOG,
      assignable: delegatablePermissions(actor),
      maximumExpiries: actor.additionalPermissionExpiries || {},
      canEdit: actor.sub !== id,
      revision: target.permissionRevision || 0,
    };
  }

  private async userQuery(actor: AuthUser) {
    this.manager(actor);

    if (actor.role === 'super_admin') return {};

    const branches = await this.scopes.getAccessibleBranchIds(actor);

    const roles = Object.keys(ranks).filter(
      (role) => ranks[role] <= ranks[actor.role],
    );

    // Coarse search is intentionally station based; full scope is verified before every grant/read.

    const alternatives: Record<string, unknown>[] = [
      { branchId: { $in: (branches || []).map((id) => this.id(id)) } },
    ];

    if (ranks[actor.role] >= 80)
      alternatives.push({
        role: {
          $in: [
            'national_admin',
            'national_pastor',
            'district_admin',
            'district_pastor',
          ],
        },
        oversightRegion: actor.oversightRegion,
      });

    if (ranks[actor.role] >= 60 && actor.district)
      alternatives.push({
        role: { $in: ['district_admin', 'district_pastor'] },
        oversightRegion: actor.oversightRegion,
        district: actor.district,
      });

    return { role: { $in: roles }, $or: alternatives };
  }

  async targets(actor: AuthUser, search = '', page = 1) {
    const query = await this.userQuery(actor);

    const escaped = search
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = {
      $and: [
        query,
        ...escaped
          .split(/\s+/)
          .filter(Boolean)
          .map((term) => ({
            $or: ['firstName', 'lastName', 'email'].map((field) => ({
              [field]: { $regex: term, $options: 'i' },
            })),
          })),
      ],
    };

    const [items, total] = await Promise.all([
      this.users
        .find(filter)
        .select('firstName lastName email role branchId')
        .sort({ firstName: 1, _id: 1 })
        .skip((page - 1) * 20)
        .limit(20)
        .lean(),
      this.users.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / 20)),
    };
  }

  private async revision(
    targetId: unknown,
    expected: number,
    session: import('mongoose').ClientSession,
  ) {
    const changed = await this.users.updateOne(
      {
        _id: targetId,
        ...(expected === 0
          ? {
              $or: [
                { permissionRevision: 0 },
                { permissionRevision: { $exists: false } },
              ],
            }
          : { permissionRevision: expected }),
      },
      { $inc: { permissionRevision: 1 } },
      { session },
    );

    if (!changed.modifiedCount)
      throw new ConflictException(
        'Permissions changed. Refresh this page and review the latest access.',
      );
  }

  async grant(actor: AuthUser, dto: GrantPermissionsDto) {
    if (dto.reason.trim().length < 3)
      throw new BadRequestException(
        'Please give a reason for this access change.',
      );

    const target = await this.person(dto.recipientId);
    await this.manageable(actor, target, true);

    if (target.isActive === false)
      throw new BadRequestException(
        'Activate the user before granting access.',
      );

    if (
      !dto.permissions.length ||
      dto.permissions.some((key) => !isPermissionKey(key))
    )
      throw new BadRequestException('Unknown permission.');
    const available = delegatablePermissions(actor);

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt.getTime() <= Date.now())
      throw new BadRequestException('Expiry must be in the future.');

    for (const key of additionalPermissionKeys({
      additionalPermissions: dto.permissions,
    })) {
      if (!available.includes(key))
        throw new ForbiddenException('You cannot delegate this permission.');

      if (
        dto.permissions.includes(key) &&
        rolePermissionKeys(target.role).includes(key)
      )
        throw new BadRequestException(
          'This permission is already included in the user’s role.',
        );

      const maximum =
        rolePermissionKeys(actor.role).includes(key) ||
        actor.role === 'super_admin'
          ? null
          : actor.additionalPermissionExpiries?.[key];

      if (maximum && (!expiresAt || expiresAt.getTime() > Date.parse(maximum)))
        throw new ForbiddenException(
          'A delegated permission cannot last longer than your own access.',
        );
    }

    const branches = await this.scopes.getAccessibleBranchIds(
      permissionSubject(target),
    );

    if (!branches?.length)
      throw new BadRequestException(
        'Assign a church scope before granting additional permissions.',
      );

    await this.grants.db.transaction(async (session) => {
      await this.revision(target._id, dto.expectedRevision, session);

      await this.grants.updateMany(
        {
          recipientId: target._id,
          status: 'active',
          permission: { $in: dto.permissions },
        },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedByUserId: this.id(actor.sub),
            revokedByName: actor.email,
            revocationReason:
              'Replaced by a renewed grant: ' + dto.reason.trim(),
          },
        },
        { session },
      );

      await this.grants.create(
        dto.permissions.map((permission) => ({
          recipientId: target._id,
          permission,
          status: 'active',
          expiresAt,
          grantedByUserId: this.id(actor.sub),
          grantedByName: actor.email,
          grantedAt: new Date(),
          reason: dto.reason.trim(),
          scopeBranchIds: branches,
          scopeProfile: permissionScopeProfile(target),
        })),
        { session },
      );
    });

    return { success: true, revision: dto.expectedRevision + 1 };
  }

  async revoke(actor: AuthUser, id: string, dto: RevokePermissionDto) {
    if (dto.reason.trim().length < 3)
      throw new BadRequestException(
        'Please give a reason for this access change.',
      );

    const grant = await this.grants.findById(this.id(id)).lean();
    if (!grant) throw new NotFoundException('Permission grant not found.');

    const target = await this.person(String(grant.recipientId));
    await this.manageable(actor, target, true);

    // Managers may remove any extra access within their full jurisdiction, even if they cannot issue it.

    await this.grants.db.transaction(async (session) => {
      await this.revision(target._id, dto.expectedRevision, session);

      const result = await this.grants.updateOne(
        { _id: grant._id, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedByUserId: this.id(actor.sub),
            revokedByName: actor.email,
            revocationReason: dto.reason.trim(),
          },
        },
        { session },
      );

      if (!result.modifiedCount)
        throw new ConflictException('This grant has already been revoked.');
    });

    return { success: true };
  }

  async revokeAll(
    actor: AuthUser,
    recipientId: string,
    dto: RevokePermissionDto,
  ) {
    if (dto.reason.trim().length < 3)
      throw new BadRequestException(
        'Please give a reason for this access change.',
      );
    const target = await this.person(recipientId);
    await this.manageable(actor, target, true);
    await this.grants.db.transaction(async (session) => {
      await this.revision(target._id, dto.expectedRevision, session);
      await this.grants.updateMany(
        { recipientId: target._id, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revokedByUserId: this.id(actor.sub),
            revokedByName: actor.email,
            revocationReason: dto.reason.trim(),
          },
        },
        { session },
      );
    });
    return { success: true };
  }
  async list(
    actor: AuthUser,
    query: {
      page?: number;
      status?: string;
      search?: string;
      recipientId?: string;
      byMe?: boolean;
      limit?: number;
    },
  ) {
    const users = await this.userQuery(actor);

    const escaped = (query.search || '')
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const now = new Date();
    const page = query.page || 1;
    const limit =
      Number.isSafeInteger(query.limit) && query.limit! > 0
        ? Math.min(query.limit!, 100)
        : 20;

    const match: Record<string, unknown> = {};

    if (query.recipientId) match.recipientId = this.id(query.recipientId);

    if (query.byMe) match.grantedByUserId = this.id(actor.sub);

    if (query.status === 'revoked') match.status = 'revoked';

    if (query.status === 'expired')
      Object.assign(match, {
        status: 'active',
        expiresAt: { $lte: now, $ne: null },
      });

    if (query.status === 'active')
      Object.assign(match, {
        status: 'active',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      });

    const branches = await this.scopes.getAccessibleBranchIds(actor);

    if (branches !== null)
      match.scopeBranchIds = {
        $in: branches,
        $not: { $elemMatch: { $nin: branches } },
      };

    const recipientMatch = Object.fromEntries(
      Object.entries(users).map(([k, v]) => [
        k === '$or' ? '$or' : 'recipient.' + k,
        k === '$or'
          ? (v as Record<string, unknown>[]).map((row) =>
              Object.fromEntries(
                Object.entries(row).map(([a, b]) => ['recipient.' + a, b]),
              ),
            )
          : v,
      ]),
    );

    const pipeline: import('mongoose').PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: this.users.collection.name,
          localField: 'recipientId',
          foreignField: '_id',
          as: 'recipient',
        },
      },
      { $unwind: '$recipient' },
      { $match: recipientMatch },
      ...(escaped
        ? [
            {
              $match: {
                $and: escaped
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((term) => ({
                    $or: [
                      'recipient.firstName',
                      'recipient.lastName',
                      'recipient.email',
                      'permission',
                      'grantedByName',
                    ].map((field) => ({
                      [field]: { $regex: term, $options: 'i' },
                    })),
                  })),
              },
            },
          ]
        : []),
      { $sort: { grantedAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                recipientId: 1,
                recipient: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  role: 1,
                  branchId: 1,
                  oversightRegion: 1,
                  district: 1,
                  permissionRevision: 1,
                },
                permission: 1,
                status: 1,
                expiresAt: 1,
                grantedByName: 1,
                grantedAt: 1,
                reason: 1,
                scopeProfile: 1,
                scopeBranchIds: 1,
                revokedAt: 1,
                revocationReason: 1,
                revokedByName: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const result = await this.grants.aggregate<{
      items: (PermissionDelegation & {
        _id: Types.ObjectId;
        recipient: Person;
      })[];
      total: { count: number }[];
    }>(pipeline);

    const total = result[0]?.total[0]?.count || 0;

    const scopeCache = new Map<
      string,
      Promise<{ scope: string[] | null; manageable: boolean }>
    >();
    const items = await Promise.all(
      (result[0]?.items || []).map(async (item) => {
        const id = String(item.recipient._id);
        if (!scopeCache.has(id))
          scopeCache.set(
            id,
            (async () => {
              try {
                const scope = await this.scopes.getAccessibleBranchIds(
                  permissionSubject(item.recipient),
                );
                const manageable =
                  actor.role === 'super_admin' ||
                  ((ranks[item.recipient.role] ?? 1000) <= ranks[actor.role] &&
                    !!branches?.length &&
                    !!scope?.length &&
                    scope.every((branch) => branches.includes(branch)));
                return { scope, manageable };
              } catch {
                return { scope: [] as string[], manageable: false };
              }
            })(),
          );
        const { scope, manageable } = await scopeCache.get(id)!;

        const status =
          item.status === 'revoked'
            ? 'revoked'
            : item.expiresAt && new Date(item.expiresAt) <= now
              ? 'expired'
              : !manageable || !grantIsCurrent(item, item.recipient, scope)
                ? 'needs_review'
                : 'active';

        return {
          ...item,
          status,
          canManage: manageable && actor.sub !== String(item.recipientId),
        };
      }),
    );

    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
