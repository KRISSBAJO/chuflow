import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import {
  isBranchScopedRole,
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { FollowUp, FollowUpDocument } from '../follow-ups/schemas/follow-up.schema';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

type SearchEntityType = 'all' | 'guests' | 'members' | 'branches' | 'users' | 'followups';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(FollowUp.name)
    private readonly followUpModel: Model<FollowUpDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private normalizeQuery(value?: string) {
    const normalized = value?.trim();
    return normalized && normalized.length >= 2 ? normalized : undefined;
  }

  private buildRegex(value?: string) {
    const normalized = this.normalizeQuery(value);
    return normalized ? new RegExp(normalized, 'i') : undefined;
  }

  private buildBranchReferenceValues(branchIds: string[]) {
    const values = new Map<string, string | Types.ObjectId>();

    for (const branchId of branchIds) {
      if (!branchId) {
        continue;
      }

      values.set(`string:${branchId}`, branchId);
      if (Types.ObjectId.isValid(branchId)) {
        values.set(`object:${branchId}`, new Types.ObjectId(branchId));
      }
    }

    return Array.from(values.values());
  }

  private buildUserScopeQuery(currentUser: AuthUser, branchIds: string[]) {
    const branchRefs = this.buildBranchReferenceValues(branchIds);

    if (isGlobalRole(currentUser.role)) {
      return {};
    }

    if (isNationalRole(currentUser.role)) {
      return {
        $or: [
          { oversightRegion: currentUser.oversightRegion },
          { branchId: { $in: branchRefs } },
        ],
      };
    }

    if (isDistrictRole(currentUser.role)) {
      return {
        $or: [
          {
            oversightRegion: currentUser.oversightRegion,
            district: currentUser.district,
          },
          { branchId: { $in: branchRefs } },
        ],
      };
    }

    if (isBranchScopedRole(currentUser.role)) {
      return {
        branchId: currentUser.branchId,
      };
    }

    return {
      branchId: { $in: branchRefs },
    };
  }

  private buildResult(
    entityType: Exclude<SearchEntityType, 'all'>,
    id: string,
    title: string,
    subtitle: string,
    href: string,
    meta?: string,
  ) {
    return {
      _id: id,
      entityType,
      title,
      subtitle,
      meta,
      href,
    };
  }

  async globalSearch(
    currentUser: AuthUser,
    filters: {
      q?: string;
      type?: SearchEntityType;
      limit?: number;
    },
  ) {
    const query = this.normalizeQuery(filters.q);
    const type = (filters.type || 'all') as SearchEntityType;
    const limit = Math.min(Math.max(filters.limit || 8, 1), 20);
    const regex = this.buildRegex(query);
    const accessibleBranches = await this.branchModel
      .find(await this.accessScopeService.getBranchDocumentQuery(currentUser))
      .select('name oversightRegion district city state address')
      .sort({ oversightRegion: 1, district: 1, name: 1 })
      .lean();
    const accessibleBranchIds = accessibleBranches.map((branch) => String(branch._id));
    const accessibleBranchObjectIds = accessibleBranchIds
      .filter((branchId) => Types.ObjectId.isValid(branchId))
      .map((branchId) => new Types.ObjectId(branchId));

    const empty = {
      guests: [],
      members: [],
      branches: [],
      users: [],
      followUps: [],
    };

    if (!regex) {
      return {
        query: filters.q?.trim() ?? '',
        type,
        scope: {
          role: currentUser.role,
          oversightRegion: currentUser.oversightRegion,
          district: currentUser.district,
          branchId: currentUser.branchId,
        },
        totals: {
          total: 0,
          guests: 0,
          members: 0,
          branches: 0,
          users: 0,
          followUps: 0,
        },
        results: empty,
      };
    }

    const shouldSearch = (target: SearchEntityType) =>
      type === 'all' || type === target;

    const guestBranchFilter =
      accessibleBranchObjectIds.length === 0 && !isGlobalRole(currentUser.role)
        ? { branchId: { $in: [] } }
        : accessibleBranchObjectIds.length
          ? { branchId: { $in: accessibleBranchObjectIds } }
          : {};
    const guestSearchQuery = {
      ...guestBranchFilter,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
        { invitedBy: regex },
        { city: regex },
        { state: regex },
      ],
    };
    const memberSearchQuery = {
      ...guestBranchFilter,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
        { title: regex },
        { familyDetails: regex },
      ],
    };
    const branchSearchQuery = {
      _id: { $in: accessibleBranches.map((branch) => branch._id) },
      $or: [
        { name: regex },
        { city: regex },
        { state: regex },
        { district: regex },
        { oversightRegion: regex },
        { address: regex },
      ],
    };
    const userSearchQuery = {
      ...this.buildUserScopeQuery(currentUser, accessibleBranchIds),
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { role: regex },
        { oversightRegion: regex },
        { district: regex },
      ],
    };
    const visibleGuestIds = shouldSearch('followups')
      ? await this.guestModel.find(guestBranchFilter).distinct('_id')
      : [];
    const matchingGuestIdsForFollowUp = shouldSearch('followups')
      ? await this.guestModel.find(guestSearchQuery).distinct('_id')
      : [];
    const followUpSearchQuery = {
      guestId: { $in: visibleGuestIds },
      $or: [
        { note: regex },
        { status: regex },
        { contactMethod: regex },
        { guestId: { $in: matchingGuestIdsForFollowUp } },
      ],
    };

    const [
      guestDocs,
      memberDocs,
      branchDocs,
      userDocs,
      followUpDocs,
      guestTotal,
      memberTotal,
      branchTotal,
      userTotal,
      followUpTotal,
    ] = await Promise.all([
      shouldSearch('guests')
        ? this.guestModel
            .find(guestSearchQuery)
            .populate('branchId', 'name oversightRegion district')
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
      shouldSearch('members')
        ? this.memberModel
            .find(memberSearchQuery)
            .populate('branchId', 'name oversightRegion district')
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
      shouldSearch('branches')
        ? this.branchModel
            .find(branchSearchQuery)
            .sort({ oversightRegion: 1, district: 1, name: 1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
      shouldSearch('users')
        ? this.userModel
            .find(userSearchQuery)
            .select('-password -passwordResetToken')
            .sort({ firstName: 1, lastName: 1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
      shouldSearch('followups')
        ? this.followUpModel
            .find(followUpSearchQuery)
            .populate({
              path: 'guestId',
              populate: { path: 'branchId', select: 'name oversightRegion district' },
            })
            .populate('assignedTo', 'firstName lastName')
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean()
        : Promise.resolve([]),
      shouldSearch('guests')
        ? this.guestModel.countDocuments(guestSearchQuery)
        : Promise.resolve(0),
      shouldSearch('members')
        ? this.memberModel.countDocuments(memberSearchQuery)
        : Promise.resolve(0),
      shouldSearch('branches')
        ? this.branchModel.countDocuments(branchSearchQuery)
        : Promise.resolve(0),
      shouldSearch('users')
        ? this.userModel.countDocuments(userSearchQuery)
        : Promise.resolve(0),
      shouldSearch('followups')
        ? this.followUpModel.countDocuments(followUpSearchQuery)
        : Promise.resolve(0),
    ]);

    const results = {
      guests: guestDocs.map((guest) =>
        this.buildResult(
          'guests',
          String(guest._id),
          `${guest.firstName} ${guest.lastName}`,
          guest.email || guest.phone,
          `/guests/${String(guest._id)}`,
          typeof guest.branchId === 'object' && guest.branchId && 'name' in guest.branchId
            ? String(guest.branchId.name ?? '')
            : undefined,
        ),
      ),
      members: memberDocs.map((member) =>
        this.buildResult(
          'members',
          String(member._id),
          `${member.firstName} ${member.lastName}`,
          member.email || member.phone || member.membershipStatus,
          `/members/${String(member._id)}`,
          typeof member.branchId === 'object' && member.branchId && 'name' in member.branchId
            ? String(member.branchId.name ?? '')
            : undefined,
        ),
      ),
      branches: branchDocs.map((branch) =>
        this.buildResult(
          'branches',
          String(branch._id),
          branch.name,
          `${branch.city}, ${branch.state}`,
          '/branches',
          `${branch.district} · ${branch.oversightRegion}`,
        ),
      ),
      users: userDocs.map((user) =>
        this.buildResult(
          'users',
          String(user._id),
          `${user.firstName} ${user.lastName}`,
          user.email,
          `/users?search=${encodeURIComponent(user.email)}`,
          user.role.replace(/_/g, ' '),
        ),
      ),
      followUps: followUpDocs.map((followUp) => {
        const guest =
          followUp.guestId && typeof followUp.guestId === 'object'
            ? (followUp.guestId as { _id?: unknown; firstName?: string; lastName?: string })
            : undefined;
        const guestName =
          guest?.firstName || guest?.lastName
            ? `${guest.firstName ?? ''} ${guest.lastName ?? ''}`.trim()
            : 'Follow-up task';

        return this.buildResult(
          'followups',
          String(followUp._id),
          guestName,
          followUp.status.replace(/_/g, ' '),
          `/follow-up?guestId=${guest?._id ? String(guest._id) : ''}`,
          followUp.note,
        );
      }),
    };

    const totals = {
      guests: guestTotal,
      members: memberTotal,
      branches: branchTotal,
      users: userTotal,
      followUps: followUpTotal,
    };

    return {
      query: query,
      type,
      scope: {
        role: currentUser.role,
        oversightRegion: currentUser.oversightRegion,
        district: currentUser.district,
        branchId: currentUser.branchId,
      },
      totals: {
        ...totals,
        total:
          totals.guests +
          totals.members +
          totals.branches +
          totals.users +
          totals.followUps,
      },
      results,
    };
  }
}
