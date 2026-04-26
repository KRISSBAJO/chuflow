import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  APP_ROLES,
  isBranchLeadershipRole,
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import { DistrictsService } from '../districts/districts.service';
import { OversightRegionsService } from '../oversight-regions/oversight-regions.service';
import { CreateUserDto, UpdateUserDto } from './dto/manage-user.dto';
import { User, UserDocument } from './schemas/user.schema';

type UserScopePayload = {
  branchId?: string;
  oversightRegion?: string;
  district?: string;
};

type UserDirectoryFilters = {
  branchId?: string;
  search?: string;
  role?: string;
  oversightRegion?: string;
  district?: string;
  status?: string;
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly configService: ConfigService,
    private readonly accessScopeService: AccessScopeService,
    private readonly oversightRegionsService: OversightRegionsService,
    private readonly districtsService: DistrictsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async onModuleInit() {
    const adminEmail = this.configService.get<string>('adminEmail')!;
    const existing = await this.userModel.findOne({ email: adminEmail });

    if (!existing) {
      const hash = await bcrypt.hash(
        this.configService.get<string>('adminPassword')!,
        10,
      );
      await this.userModel.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: adminEmail,
        password: hash,
        role: 'super_admin',
        isActive: true,
      });
    }
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).select('-password').exec();
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('-password -passwordResetToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private getVisibleRoles(currentUserRole: string) {
    if (isGlobalRole(currentUserRole)) {
      return [...APP_ROLES];
    }

    if (isNationalRole(currentUserRole)) {
      return [
        'national_admin',
        'national_pastor',
        'district_admin',
        'district_pastor',
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'follow_up',
        'usher',
      ];
    }

    if (isDistrictRole(currentUserRole)) {
      return [
        'district_admin',
        'district_pastor',
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'follow_up',
        'usher',
      ];
    }

    if (isBranchLeadershipRole(currentUserRole)) {
      return ['branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher'];
    }

    return [currentUserRole];
  }

  private getManageableRoles(currentUserRole: string) {
    if (isGlobalRole(currentUserRole)) {
      return [...APP_ROLES];
    }

    if (currentUserRole === 'national_admin') {
      return [
        'national_admin',
        'national_pastor',
        'district_admin',
        'district_pastor',
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'follow_up',
        'usher',
      ];
    }

    if (currentUserRole === 'district_admin') {
      return [
        'district_admin',
        'district_pastor',
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'follow_up',
        'usher',
      ];
    }

    if (currentUserRole === 'branch_admin') {
      return ['branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher'];
    }

    return [];
  }

  private async getBranchScope(branchId: string) {
    const branch = await this.branchModel
      .findById(branchId)
      .select('oversightRegion district')
      .lean();

    if (!branch) {
      throw new BadRequestException('Selected branch was not found');
    }

    return {
      branchId: String(branch._id),
      oversightRegion: branch.oversightRegion,
      district: branch.district,
    };
  }

  private normalizeScopeInput(value?: string) {
    const normalized = value?.trim();
    return normalized || undefined;
  }

  private async resolveScopeForRole(
    currentUser: AuthUser,
    role: string,
    input: Pick<CreateUserDto, 'branchId' | 'oversightRegion' | 'district'>,
  ): Promise<UserScopePayload> {
    if (role === 'super_admin') {
      return {
        branchId: undefined,
        oversightRegion: undefined,
        district: undefined,
      };
    }

    if (isNationalRole(role)) {
      const oversightRegion = isGlobalRole(currentUser.role)
        ? this.normalizeScopeInput(input.oversightRegion)
        : currentUser.oversightRegion;

      if (!oversightRegion) {
        throw new BadRequestException(
          'An oversight region is required for national leadership users',
        );
      }

      await this.oversightRegionsService.ensureExists(oversightRegion);

      return {
        branchId: undefined,
        oversightRegion,
        district: undefined,
      };
    }

    if (isDistrictRole(role)) {
      const oversightRegion = isGlobalRole(currentUser.role)
        ? this.normalizeScopeInput(input.oversightRegion)
        : currentUser.oversightRegion;
      const district = this.normalizeScopeInput(input.district);

      if (!oversightRegion) {
        throw new BadRequestException(
          'An oversight region is required for district leadership users',
        );
      }

      if (!district) {
        throw new BadRequestException(
          'A district is required for district leadership users',
        );
      }

      await this.districtsService.ensureExists(oversightRegion, district);

      return {
        branchId: undefined,
        oversightRegion,
        district,
      };
    }

    if (isBranchScopedRole(role)) {
      const branchId =
        isBranchScopedRole(currentUser.role) && !isGlobalRole(currentUser.role)
          ? currentUser.branchId
          : input.branchId;

      if (!branchId) {
        throw new BadRequestException(
          'A branch is required for branch-scoped users',
        );
      }

      await this.accessScopeService.ensureBranchAccess(currentUser, branchId);
      return this.getBranchScope(branchId);
    }

    throw new BadRequestException('Unsupported role scope');
  }

  private validateRoleAssignment(currentUser: AuthUser, role: string) {
    if (!APP_ROLES.includes(role as (typeof APP_ROLES)[number])) {
      throw new BadRequestException('Invalid role selected');
    }

    if (this.getManageableRoles(currentUser.role).includes(role as never)) {
      return;
    }

    if (isGlobalRole(currentUser.role)) {
      return;
    }

    throw new ForbiddenException('You cannot assign that role');
  }

  private async ensureManageableTarget(currentUser: AuthUser, userId: string) {
    const target = await this.userModel
      .findById(userId)
      .select('-password -passwordResetToken')
      .lean();

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (isGlobalRole(currentUser.role)) {
      return target;
    }

    const visibleRoles = this.getVisibleRoles(currentUser.role);
    if (!visibleRoles.includes(target.role as never)) {
      throw new ForbiddenException('You cannot view or manage that user');
    }

    if (target.branchId) {
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        String(target.branchId),
      );
      return target;
    }

    if (isNationalRole(currentUser.role)) {
      if (target.oversightRegion !== currentUser.oversightRegion) {
        throw new ForbiddenException(
          'You cannot manage users outside your oversight region',
        );
      }
      return target;
    }

    if (isDistrictRole(currentUser.role)) {
      if (
        target.oversightRegion !== currentUser.oversightRegion ||
        target.district !== currentUser.district
      ) {
        throw new ForbiddenException(
          'You cannot manage users outside your district',
        );
      }
      return target;
    }

    throw new ForbiddenException('You cannot manage this user');
  }

  private async ensureEmailAvailable(email: string, currentUserId?: string) {
    const existing = await this.userModel.findOne({ email }).lean();

    if (existing && String(existing._id) !== currentUserId) {
      throw new BadRequestException('A user with this email already exists');
    }
  }

  private async ensureUniquePastoralBranchRole(
    role: string,
    branchId?: string,
    currentUserId?: string,
  ) {
    if (!branchId) {
      return;
    }

    if (!['resident_pastor', 'associate_pastor'].includes(role)) {
      return;
    }

    const existing = await this.userModel
      .findOne({
        role,
        branchId,
        ...(currentUserId ? { _id: { $ne: currentUserId } } : {}),
      })
      .select('_id firstName lastName')
      .lean();

    if (existing) {
      throw new BadRequestException(
        `${
          role === 'resident_pastor' ? 'Resident pastor' : 'Associate pastor'
        } is already assigned in this branch`,
      );
    }
  }

  private async buildUserDirectoryQuery(
    currentUser: AuthUser,
    filters: UserDirectoryFilters = {},
  ) {
    const query: Record<string, unknown> = {};
    const visibleRoles = this.getVisibleRoles(currentUser.role);

    if (filters.role) {
      if (!visibleRoles.includes(filters.role as never)) {
        throw new ForbiddenException('You cannot view users for that role');
      }
      query.role = filters.role;
    } else if (!isGlobalRole(currentUser.role)) {
      query.role = { $in: visibleRoles };
    }

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.status === 'active') {
      query.isActive = true;
    } else if (filters.status === 'inactive') {
      query.isActive = false;
    }

    if (filters.branchId) {
      await this.accessScopeService.ensureBranchAccess(currentUser, filters.branchId);
      query.branchId = filters.branchId;

      if (filters.role) {
        if (!isBranchScopedRole(filters.role)) {
          return null;
        }
      } else {
        query.role = {
          $in: visibleRoles.filter((role) => isBranchScopedRole(role)),
        };
      }

      return query;
    }

    if (isBranchScopedRole(currentUser.role)) {
      query.branchId = currentUser.branchId;
      return query;
    }

    if (isDistrictRole(currentUser.role)) {
      query.oversightRegion = currentUser.oversightRegion;
      query.district = currentUser.district;
      return query;
    }

    if (isNationalRole(currentUser.role)) {
      query.oversightRegion = currentUser.oversightRegion;

      if (filters.district) {
        query.district = filters.district;
      }

      return query;
    }

    if (filters.oversightRegion) {
      query.oversightRegion = filters.oversightRegion;
    }

    if (filters.district) {
      query.district = filters.district;
    }

    return query;
  }

  async findAssignableUsers(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      search?: string;
      role?: string;
      oversightRegion?: string;
      district?: string;
    } = {},
  ) {
    const query = await this.buildUserDirectoryQuery(currentUser, filters);

    if (!query) {
      return [];
    }

    return this.userModel
      .find(query)
      .select('-password -passwordResetToken')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findUserDirectory(
    currentUser: AuthUser,
    filters: UserDirectoryFilters & {
      page?: number;
      limit?: number;
    } = {},
  ) {
    const query = await this.buildUserDirectoryQuery(currentUser, filters);
    const safeLimit = Math.min(Math.max(filters.limit || 12, 1), 100);
    const requestedPage = Math.max(filters.page || 1, 1);

    if (!query) {
      return {
        items: [],
        pagination: {
          page: 1,
          pageSize: safeLimit,
          total: 0,
          totalPages: 1,
        },
        summary: {
          total: 0,
          active: 0,
          inactive: 0,
          followUp: 0,
          ushers: 0,
        },
      };
    }

    const total = await this.userModel.countDocuments(query);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const [items, summaryRows] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.userModel.aggregate<{
        _id: null;
        total: number;
        active: number;
        inactive: number;
        followUp: number;
        ushers: number;
      }>([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
            },
            inactive: {
              $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
            },
            followUp: {
              $sum: { $cond: [{ $eq: ['$role', 'follow_up'] }, 1, 0] },
            },
            ushers: {
              $sum: { $cond: [{ $eq: ['$role', 'usher'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const summary = summaryRows[0] ?? {
      total: 0,
      active: 0,
      inactive: 0,
      followUp: 0,
      ushers: 0,
    };

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages,
      },
      summary: {
        total: summary.total,
        active: summary.active,
        inactive: summary.inactive,
        followUp: summary.followUp,
        ushers: summary.ushers,
      },
    };
  }

  async create(currentUser: AuthUser, dto: CreateUserDto) {
    this.validateRoleAssignment(currentUser, dto.role);
    await this.ensureEmailAvailable(dto.email);

    const scope = await this.resolveScopeForRole(currentUser, dto.role, dto);
    await this.ensureUniquePastoralBranchRole(dto.role, scope.branchId);
    const password = await bcrypt.hash(dto.password, 10);

    const user = await this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      role: dto.role,
      ...scope,
      password,
      isActive: dto.isActive ?? true,
    });

    await this.auditLogsService.record({
      entityType: 'user',
      entityId: String(user._id),
      action: 'created',
      summary: `User ${dto.firstName} ${dto.lastName} created as ${dto.role.replace(/_/g, ' ')}`,
      actor: currentUser,
      branchId: scope.branchId,
      oversightRegion: scope.oversightRegion,
      district: scope.district,
      metadata: {
        role: dto.role,
        email: dto.email,
        isActive: dto.isActive ?? true,
      },
    });

    return this.findOneForAdmin(currentUser, user.id);
  }

  async findOneForAdmin(currentUser: AuthUser, userId: string) {
    const target = await this.userModel
      .findById(userId)
      .select('-password -passwordResetToken')
      .lean();

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (!isGlobalRole(currentUser.role)) {
      await this.ensureManageableTarget(currentUser, userId);
    }

    return target;
  }

  async update(currentUser: AuthUser, userId: string, dto: UpdateUserDto) {
    const target = await this.ensureManageableTarget(currentUser, userId);
    const attemptedPrivilegedChange =
      dto.role !== undefined ||
      dto.branchId !== undefined ||
      dto.oversightRegion !== undefined ||
      dto.district !== undefined ||
      dto.isActive !== undefined ||
      dto.password !== undefined;

    if (
      isBranchLeadershipRole(currentUser.role) &&
      userId === currentUser.sub &&
      attemptedPrivilegedChange
    ) {
      throw new ForbiddenException(
        'Branch leaders cannot change their own role, scope, status, or password here',
      );
    }

    if (dto.role) {
      this.validateRoleAssignment(currentUser, dto.role);
    }

    if (dto.email) {
      await this.ensureEmailAvailable(dto.email, userId);
    }

    const nextRole = dto.role ?? target.role;
    const scope = await this.resolveScopeForRole(currentUser, nextRole, {
      branchId:
        dto.branchId !== undefined ? dto.branchId : String(target.branchId ?? ''),
      oversightRegion:
        dto.oversightRegion !== undefined
          ? dto.oversightRegion
          : target.oversightRegion,
      district: dto.district !== undefined ? dto.district : target.district,
    });
    await this.ensureUniquePastoralBranchRole(nextRole, scope.branchId, userId);

    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, 1> = {};

    if (dto.firstName !== undefined) {
      setPayload.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      setPayload.lastName = dto.lastName;
    }

    if (dto.email !== undefined) {
      setPayload.email = dto.email;
    }

    if (dto.role !== undefined) {
      setPayload.role = nextRole;
    }

    if (dto.isActive !== undefined) {
      setPayload.isActive = dto.isActive;
    }

    if (scope.branchId) {
      setPayload.branchId = scope.branchId;
    } else {
      unsetPayload.branchId = 1;
    }

    if (scope.oversightRegion) {
      setPayload.oversightRegion = scope.oversightRegion;
    } else {
      unsetPayload.oversightRegion = 1;
    }

    if (scope.district) {
      setPayload.district = scope.district;
    } else {
      unsetPayload.district = 1;
    }

    if (dto.password) {
      setPayload.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          ...(Object.keys(setPayload).length > 0 ? { $set: setPayload } : {}),
          ...(Object.keys(unsetPayload).length > 0 ? { $unset: unsetPayload } : {}),
        },
        { new: true },
      )
      .select('-password -passwordResetToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.auditLogsService.record({
      entityType: 'user',
      entityId: userId,
      action: 'updated',
      summary: `User ${user.firstName} ${user.lastName} profile updated`,
      actor: currentUser,
      branchId: scope.branchId,
      oversightRegion: scope.oversightRegion,
      district: scope.district,
      metadata: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        role: dto.role,
        isActive: dto.isActive,
        passwordChanged: dto.password !== undefined,
      },
    });

    return user;
  }

  async updatePassword(userId: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        password: hash,
        passwordResetToken: undefined,
        passwordResetExpiresAt: undefined,
      },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
      { new: true },
    );
  }

  findByPasswordResetToken(tokenHash: string) {
    return this.userModel
      .findOne({
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      })
      .exec();
  }

  clearPasswordResetToken(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      passwordResetToken: undefined,
      passwordResetExpiresAt: undefined,
    });
  }

  touchLastLogin(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      lastLoginAt: new Date(),
    });
  }
}
