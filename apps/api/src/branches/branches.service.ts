import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  BRANCH_SCOPED_ROLES,
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { DistrictsService } from '../districts/districts.service';
import { OversightRegionsService } from '../oversight-regions/oversight-regions.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';
import { Branch, BranchDocument } from './schemas/branch.schema';

export type BranchTeamSummary = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
};

export type BranchOverviewSummary = {
  _id: string;
  name: string;
  oversightRegion: string;
  district: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contactInfo: string;
  serviceTimes: string;
  status: string;
  metrics: {
    guestCount: number;
    memberCount: number;
    teamCount: number;
    activeUserCount: number;
    branchAdminCount: number;
    residentPastorCount: number;
    associatePastorCount: number;
    followUpCount: number;
    usherCount: number;
  };
  admins: BranchTeamSummary[];
  residentPastors: BranchTeamSummary[];
  associatePastors: BranchTeamSummary[];
  followUpTeam: BranchTeamSummary[];
  ushers: BranchTeamSummary[];
};

export type DistrictStructureSummary = {
  name: string;
  branchCount: number;
  guestCount: number;
  memberCount: number;
  districtAdmins: BranchTeamSummary[];
  districtPastors: BranchTeamSummary[];
  branches: BranchOverviewSummary[];
};

export type OversightRegionStructureSummary = {
  name: string;
  districtCount: number;
  branchCount: number;
  guestCount: number;
  memberCount: number;
  nationalAdmins: BranchTeamSummary[];
  nationalPastors: BranchTeamSummary[];
  districts: DistrictStructureSummary[];
};

export type BranchStructureSummary = {
  scope: {
    role: string;
    oversightRegion?: string;
    district?: string;
    branchId?: string;
  };
  summary: {
    overallHeadCount: number;
    oversightRegionCount: number;
    districtCount: number;
    branchCount: number;
    guestCount: number;
    memberCount: number;
    nationalLeaderCount: number;
    districtLeaderCount: number;
    branchLeaderCount: number;
    supportStaffCount: number;
  };
  overallHeads: BranchTeamSummary[];
  oversightRegions: OversightRegionStructureSummary[];
};

type BranchCounts = {
  guestCountMap: Map<string, number>;
  memberCountMap: Map<string, number>;
};

type LeanUserShape = {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  oversightRegion?: string;
  district?: string;
  branchId?: unknown;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
};

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly oversightRegionsService: OversightRegionsService,
    private readonly districtsService: DistrictsService,
  ) {}

  private buildScopedBranchPayload(
    currentUser: AuthUser,
    dto: CreateBranchDto | UpdateBranchDto,
  ) {
    if (isGlobalRole(currentUser.role)) {
      return dto;
    }

    if (isDistrictRole(currentUser.role)) {
      return {
        ...dto,
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
      };
    }

    throw new ForbiddenException('You cannot manage branch structure from your role');
  }

  private async ensureHierarchyCatalogEntries(
    payload: CreateBranchDto | UpdateBranchDto,
    currentUser: AuthUser,
  ) {
    const oversightRegion = payload.oversightRegion?.trim();
    const district = payload.district?.trim();

    if (!oversightRegion) {
      throw new ForbiddenException('An oversight region is required for this branch');
    }

    await this.oversightRegionsService.ensureExists(oversightRegion);

    if (!district) {
      throw new ForbiddenException('A district is required for this branch');
    }

    await this.districtsService.ensureExists(oversightRegion, district);

    if (isNationalRole(currentUser.role) && currentUser.oversightRegion !== oversightRegion) {
      throw new ForbiddenException('You cannot place a branch outside your oversight region');
    }

    if (isDistrictRole(currentUser.role) && currentUser.district !== district) {
      throw new ForbiddenException('You cannot place a branch outside your district');
    }
  }

  private toTeamSummary(user: LeanUserShape): BranchTeamSummary {
    const normalizedBranchId = this.normalizeBranchRef(user.branchId);

    return {
      _id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      oversightRegion: user.oversightRegion,
      district: user.district,
      branchId: normalizedBranchId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private normalizeBranchRef(branchRef: unknown): string | undefined {
    if (!branchRef) {
      return undefined;
    }

    if (typeof branchRef === 'string') {
      const normalized = branchRef.trim();
      return normalized || undefined;
    }

    if (typeof branchRef === 'object' && branchRef !== null) {
      const nestedId = (branchRef as { _id?: unknown })._id;
      if (nestedId) {
        return this.normalizeBranchRef(nestedId);
      }
    }

    const normalized = String(branchRef).trim();
    return normalized && normalized !== '[object Object]' ? normalized : undefined;
  }

  private buildBranchReferenceValues(branchIds: unknown[]) {
    const values = new Map<string, string | Types.ObjectId>();

    for (const branchId of branchIds) {
      const normalized = this.normalizeBranchRef(branchId);

      if (!normalized) {
        continue;
      }

      values.set(`string:${normalized}`, normalized);
      if (Types.ObjectId.isValid(normalized)) {
        values.set(`object:${normalized}`, new Types.ObjectId(normalized));
      }
    }

    return Array.from(values.values());
  }

  private buildVisibleUserQuery(currentUser: AuthUser) {
    if (isGlobalRole(currentUser.role)) {
      return {};
    }

    if (isNationalRole(currentUser.role)) {
      return {
        oversightRegion: currentUser.oversightRegion,
      };
    }

    if (isDistrictRole(currentUser.role)) {
      return {
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
      };
    }

    if (isBranchScopedRole(currentUser.role)) {
      return {
        branchId: currentUser.branchId,
      };
    }

    return {
      branchId: currentUser.branchId,
    };
  }

  private async getBranchCounts(branchIds: unknown[]): Promise<BranchCounts> {
    const branchRefs = branchIds.flatMap((branchId) => {
      const normalized = this.normalizeBranchRef(branchId);

      if (!normalized) {
        return [];
      }

      return normalized;
    });

    const [guestCounts, memberCounts] = await Promise.all([
      this.guestModel.aggregate([
        { $match: { branchId: { $in: branchRefs } } },
        { $group: { _id: '$branchId', total: { $sum: 1 } } },
      ]),
      this.memberModel.aggregate([
        { $match: { branchId: { $in: branchRefs } } },
        { $group: { _id: '$branchId', total: { $sum: 1 } } },
      ]),
    ]);

    return {
      guestCountMap: new Map(
        guestCounts.map((item: { _id: unknown; total: number }) => [
          String(item._id),
          item.total,
        ]),
      ),
      memberCountMap: new Map(
        memberCounts.map((item: { _id: unknown; total: number }) => [
          String(item._id),
          item.total,
        ]),
      ),
    };
  }

  private buildBranchOverview(
    branch: Branch,
    users: LeanUserShape[],
    counts: BranchCounts,
  ): BranchOverviewSummary {
    const branchKey = String((branch as Branch & { _id: unknown })._id);
    const branchUsers = users.filter(
      (user) => this.normalizeBranchRef(user.branchId) === branchKey,
    );
    const oversightRegion = branch.oversightRegion || 'Unassigned National Area';
    const district = branch.district || 'Unassigned District';
    const admins = branchUsers.filter((user) => user.role === 'branch_admin').map((user) => this.toTeamSummary(user));
    const residentPastors = branchUsers
      .filter((user) => user.role === 'resident_pastor')
      .map((user) => this.toTeamSummary(user));
    const associatePastors = branchUsers
      .filter((user) => user.role === 'associate_pastor')
      .map((user) => this.toTeamSummary(user));
    const followUpTeam = branchUsers
      .filter((user) => user.role === 'follow_up')
      .map((user) => this.toTeamSummary(user));
    const ushers = branchUsers
      .filter((user) => user.role === 'usher')
      .map((user) => this.toTeamSummary(user));

    return {
      _id: branchKey,
      name: branch.name,
      oversightRegion,
      district,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      country: branch.country,
      contactInfo: branch.contactInfo,
      serviceTimes: branch.serviceTimes,
      status: branch.status,
      metrics: {
        guestCount: counts.guestCountMap.get(branchKey) ?? 0,
        memberCount: counts.memberCountMap.get(branchKey) ?? 0,
        teamCount: branchUsers.length,
        activeUserCount: branchUsers.filter((user) => user.isActive).length,
        branchAdminCount: admins.length,
        residentPastorCount: residentPastors.length,
        associatePastorCount: associatePastors.length,
        followUpCount: followUpTeam.length,
        usherCount: ushers.length,
      },
      admins,
      residentPastors,
      associatePastors,
      followUpTeam,
      ushers,
    };
  }

  create(dto: CreateBranchDto, currentUser: AuthUser) {
    const payload = this.buildScopedBranchPayload(currentUser, dto);

    return this.ensureHierarchyCatalogEntries(payload, currentUser).then(() =>
      this.branchModel.create(payload),
    );
  }

  async findAll(currentUser: AuthUser) {
    return this.branchModel
      .find(await this.accessScopeService.getBranchDocumentQuery(currentUser))
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean();
  }

  async findOverview(currentUser: AuthUser): Promise<BranchOverviewSummary[]> {
    const branches = await this.branchModel
      .find(await this.accessScopeService.getBranchDocumentQuery(currentUser))
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean();
    const branchIds = branches.map((branch) => branch._id);
    const branchRefs = this.buildBranchReferenceValues(branchIds);
    const [counts, users] = await Promise.all([
      this.getBranchCounts(branchIds),
      this.userModel
        .find({
          role: { $in: BRANCH_SCOPED_ROLES },
          branchId: { $in: branchRefs },
        })
        .select('-password -passwordResetToken')
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
    ]);

    return branches.map((branch) =>
      this.buildBranchOverview(branch as Branch, users as LeanUserShape[], counts),
    );
  }

  async findStructure(currentUser: AuthUser): Promise<BranchStructureSummary> {
    const branches = await this.branchModel
      .find(await this.accessScopeService.getBranchDocumentQuery(currentUser))
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean();
    const branchIds = branches.map((branch) => branch._id);
    const branchRefs = this.buildBranchReferenceValues(branchIds);
    const [counts, branchUsers, oversightUsers, oversightRegionCatalogs, districtCatalogs] =
      await Promise.all([
      this.getBranchCounts(branchIds),
      this.userModel
        .find({
          role: { $in: BRANCH_SCOPED_ROLES },
          branchId: { $in: branchRefs },
        })
        .select('-password -passwordResetToken')
        .sort({ oversightRegion: 1, district: 1, firstName: 1, lastName: 1 })
        .lean(),
      this.userModel
        .find({
          ...this.buildVisibleUserQuery(currentUser),
          role: { $nin: BRANCH_SCOPED_ROLES },
        })
        .select('-password -passwordResetToken')
        .sort({ oversightRegion: 1, district: 1, firstName: 1, lastName: 1 })
        .lean(),
      this.oversightRegionsService.findAll(currentUser),
      this.districtsService.findAll(currentUser),
    ]);

    const typedUsers = [...(oversightUsers as LeanUserShape[]), ...(branchUsers as LeanUserShape[])];
    const branchOverviews = branches.map((branch) =>
      this.buildBranchOverview(branch as Branch, branchUsers as LeanUserShape[], counts),
    );

    const overallHeads = typedUsers
      .filter((user) => user.role === 'super_admin')
      .map((user) => this.toTeamSummary(user));

    const regionNames = [
      ...new Set(
        [
          ...branchOverviews.map((branch) => branch.oversightRegion),
          ...oversightRegionCatalogs.map((region) => region.name),
          ...typedUsers
            .map((user) => user.oversightRegion)
            .filter((value): value is string => !!value?.trim()),
        ].filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right));

    const oversightRegions: OversightRegionStructureSummary[] = regionNames.map((regionName) => {
      const regionBranches = branchOverviews.filter(
        (branch) => branch.oversightRegion === regionName,
      );
      const districtNames = [
        ...new Set(
          [
            ...regionBranches.map((branch) => branch.district),
            ...districtCatalogs
              .filter((district) => district.oversightRegion === regionName)
              .map((district) => district.name),
            ...typedUsers
              .filter((user) => user.oversightRegion === regionName)
              .map((user) => user.district)
              .filter((value): value is string => !!value?.trim()),
          ].filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right));

      const districts: DistrictStructureSummary[] = districtNames.map((districtName) => {
        const districtBranches = regionBranches.filter(
          (branch) => branch.district === districtName,
        );

        return {
          name: districtName,
          branchCount: districtBranches.length,
          guestCount: districtBranches.reduce(
            (total, branch) => total + branch.metrics.guestCount,
            0,
          ),
          memberCount: districtBranches.reduce(
            (total, branch) => total + branch.metrics.memberCount,
            0,
          ),
          districtAdmins: typedUsers
            .filter(
              (user) =>
                user.role === 'district_admin' &&
                user.oversightRegion === regionName &&
                user.district === districtName,
            )
            .map((user) => this.toTeamSummary(user)),
          districtPastors: typedUsers
            .filter(
              (user) =>
                user.role === 'district_pastor' &&
                user.oversightRegion === regionName &&
                user.district === districtName,
            )
            .map((user) => this.toTeamSummary(user)),
          branches: districtBranches,
        };
      });

      return {
        name: regionName,
        districtCount: districts.length,
        branchCount: regionBranches.length,
        guestCount: regionBranches.reduce(
          (total, branch) => total + branch.metrics.guestCount,
          0,
        ),
        memberCount: regionBranches.reduce(
          (total, branch) => total + branch.metrics.memberCount,
          0,
        ),
        nationalAdmins: typedUsers
          .filter(
            (user) =>
              user.role === 'national_admin' && user.oversightRegion === regionName,
          )
          .map((user) => this.toTeamSummary(user)),
        nationalPastors: typedUsers
          .filter(
            (user) =>
              user.role === 'national_pastor' && user.oversightRegion === regionName,
          )
          .map((user) => this.toTeamSummary(user)),
        districts,
      };
    });

    return {
      scope: {
        role: currentUser.role,
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
        branchId: currentUser.branchId,
      },
      summary: {
        overallHeadCount: overallHeads.length,
        oversightRegionCount: oversightRegions.length,
        districtCount: oversightRegions.reduce(
          (total, region) => total + region.districts.length,
          0,
        ),
        branchCount: branchOverviews.length,
        guestCount: branchOverviews.reduce(
          (total, branch) => total + branch.metrics.guestCount,
          0,
        ),
        memberCount: branchOverviews.reduce(
          (total, branch) => total + branch.metrics.memberCount,
          0,
        ),
        nationalLeaderCount: typedUsers.filter((user) =>
          ['national_admin', 'national_pastor'].includes(user.role),
        ).length,
        districtLeaderCount: typedUsers.filter((user) =>
          ['district_admin', 'district_pastor'].includes(user.role),
        ).length,
        branchLeaderCount: typedUsers.filter((user) =>
          ['branch_admin', 'resident_pastor', 'associate_pastor'].includes(user.role),
        ).length,
        supportStaffCount: typedUsers.filter((user) =>
          ['follow_up', 'usher'].includes(user.role),
        ).length,
      },
      overallHeads,
      oversightRegions,
    };
  }

  async findOne(id: string, currentUser: AuthUser) {
    await this.accessScopeService.ensureBranchAccess(currentUser, id);

    const branch = await this.branchModel.findById(id).lean();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, currentUser: AuthUser) {
    await this.accessScopeService.ensureBranchAccess(currentUser, id);

    const payload = this.buildScopedBranchPayload(currentUser, dto);
    const existing = await this.branchModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Branch not found');
    }

    await this.ensureHierarchyCatalogEntries(
      {
        ...existing,
        ...payload,
      } as UpdateBranchDto,
      currentUser,
    );

    const branch = await this.branchModel
      .findByIdAndUpdate(id, payload, {
        new: true,
      })
      .lean();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }
}
