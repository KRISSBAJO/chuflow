import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Communication, CommunicationDocument } from '../communications/schemas/communication.schema';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { FollowUp, FollowUpDocument } from '../follow-ups/schemas/follow-up.schema';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { VisitsService } from '../visits/visits.service';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { CreateGuestDto, UpdateGuestDto } from './dto/create-guest.dto';
import { Guest, GuestDocument } from './schemas/guest.schema';

@Injectable()
export class GuestsService {
  constructor(
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    @InjectModel(FollowUp.name) private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Communication.name) private readonly communicationModel: Model<CommunicationDocument>,
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    private readonly visitsService: VisitsService,
    private readonly followUpsService: FollowUpsService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async ensureGuestScope(guest: { branchId?: unknown }, currentUser?: AuthUser) {
    if (!currentUser) {
      return;
    }

    const branchValue =
      typeof guest.branchId === 'string'
        ? guest.branchId
        : typeof guest.branchId === 'object' && guest.branchId !== null && '_id' in guest.branchId
          ? String((guest.branchId as { _id?: unknown })._id)
          : guest.branchId
            ? String(guest.branchId)
            : undefined;

    await this.accessScopeService.ensureBranchAccess(currentUser, branchValue);
  }

  private getNormalizedPhone(phone?: string) {
    return phone ? phone.replace(/\D/g, '') : '';
  }

  private normalizeSearch(search?: string) {
    const trimmed = search?.trim();
    return trimmed ? trimmed : undefined;
  }

  private buildGuestSearchConditions(search?: string) {
    const normalizedSearch = this.normalizeSearch(search);

    if (!normalizedSearch) {
      return undefined;
    }

    return [
      { firstName: { $regex: normalizedSearch, $options: 'i' } },
      { lastName: { $regex: normalizedSearch, $options: 'i' } },
      { phone: { $regex: normalizedSearch, $options: 'i' } },
      { email: { $regex: normalizedSearch, $options: 'i' } },
    ];
  }

  private mergeGuestPayload(
    target: GuestDocument | (Guest & { _id?: unknown; children?: string[] }),
    source: GuestDocument | (Guest & { _id?: unknown; children?: string[] }),
  ) {
    const nextChildren = Array.from(new Set([...(target.children ?? []), ...(source.children ?? [])]));

    return {
      title: target.title || source.title,
      firstName: target.firstName || source.firstName,
      lastName: target.lastName || source.lastName,
      gender: target.gender || source.gender,
      phone: target.phone || source.phone,
      email: target.email || source.email,
      dateOfBirth: target.dateOfBirth || source.dateOfBirth,
      address: target.address || source.address,
      city: target.city || source.city,
      state: target.state || source.state,
      zipCode: target.zipCode || source.zipCode,
      maritalStatus: target.maritalStatus || source.maritalStatus,
      spouseDetails: target.spouseDetails || source.spouseDetails,
      children: nextChildren,
      visitStatus: target.visitStatus === 'member' || source.visitStatus === 'member' ? 'member' : target.visitStatus || source.visitStatus,
      invitedBy: target.invitedBy || source.invitedBy,
      heardAboutChurch: target.heardAboutChurch || source.heardAboutChurch,
      prayerRequest: target.prayerRequest || source.prayerRequest,
      wantsPastoralCall: target.wantsPastoralCall || source.wantsPastoralCall,
      salvationResponse: target.salvationResponse || source.salvationResponse,
      convertedToMember: target.convertedToMember || source.convertedToMember,
    };
  }

  async create(dto: CreateGuestDto, currentUser?: AuthUser) {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);
    const duplicate = await this.guestModel.findOne({
      $or: [{ phone: dto.phone }, ...(dto.email ? [{ email: dto.email }] : [])],
    });

    if (duplicate) {
      throw new BadRequestException('Guest with this phone or email already exists');
    }

    const guest = await this.guestModel.create({
      ...dto,
      branchId,
      visitStatus: dto.visitStatus ?? 'first_time',
    });

    await this.visitsService.create({
      branchId: branchId!,
      guestId: guest.id,
      visitDate: dto.visitDate ?? new Date().toISOString(),
      serviceType: dto.serviceType ?? 'Sunday service',
      notes: 'Auto-created from guest registration',
    }, currentUser);

    await this.followUpsService.create({
      guestId: guest.id,
      assignedTo: dto.assignedFollowUpUserId,
      status: dto.assignedFollowUpUserId ? 'assigned' : 'new',
      contactMethod: 'registration',
      note: 'Guest registered and follow-up record created.',
    }, currentUser);

    return this.findOne(guest.id, currentUser);
  }

  async findAll(
    currentUser: AuthUser,
    branchId?: string,
    search?: string,
    page = 1,
    limit = 20,
  ) {
    const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
    const requestedPage = Math.max(page || 1, 1);
    const searchConditions = this.buildGuestSearchConditions(search);
    const documentQuery: Record<string, unknown> = {
      ...(await this.accessScopeService.buildBranchFilter(currentUser, branchId)),
    };
    const branchObjectIdFilter = await this.accessScopeService.buildBranchObjectIdFilter(
      currentUser,
      branchId,
    );
    const aggregateQuery: Record<string, unknown> = {
      ...branchObjectIdFilter,
    };

    if (searchConditions) {
      documentQuery.$or = searchConditions;
      aggregateQuery.$or = searchConditions;
    }

    const [total, todayCount, completedCardsCount] = await Promise.all([
      this.guestModel.countDocuments(documentQuery),
      this.guestModel.countDocuments({
        ...documentQuery,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      this.guestModel.countDocuments({
        ...documentQuery,
        phone: { $exists: true, $ne: '' },
        email: { $exists: true, $ne: '' },
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(requestedPage, totalPages);
    const skip = (safePage - 1) * safeLimit;

    const branchLookupMatch = (
      branchObjectIdFilter as { branchId?: Types.ObjectId | { $in: Types.ObjectId[] } }
    ).branchId;
    const guestLookupMatches: Record<string, unknown>[] = [];

    if (branchLookupMatch) {
      guestLookupMatches.push({ 'guest.branchId': branchLookupMatch });
    }

    if (searchConditions) {
      guestLookupMatches.push({
        $or: searchConditions.map((condition) => {
          const [field, value] = Object.entries(condition)[0];
          return { [`guest.${field}`]: value };
        }),
      });
    }

    const [items, assignedFollowUpCountRaw] = await Promise.all([
      this.guestModel.aggregate([
        { $match: aggregateQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit },
        {
          $lookup: {
            from: 'branches',
            localField: 'branchId',
            foreignField: '_id',
            as: 'branch',
          },
        },
        {
          $unwind: {
            path: '$branch',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'followups',
            let: { guestId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$guestId', '$$guestId'],
                  },
                },
              },
              { $sort: { updatedAt: -1 } },
              { $limit: 1 },
            ],
            as: 'latestFollowUp',
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            phone: 1,
            email: 1,
            visitStatus: 1,
            createdAt: 1,
            nextFollowUpStatus: {
              $let: {
                vars: {
                  latest: { $arrayElemAt: ['$latestFollowUp', 0] },
                },
                in: '$$latest.status',
              },
            },
            branchId: {
              _id: '$branch._id',
              name: '$branch.name',
            },
          },
        },
      ]),
      this.followUpModel.aggregate<{ total: number }>([
        {
          $lookup: {
            from: 'guests',
            localField: 'guestId',
            foreignField: '_id',
            as: 'guest',
          },
        },
        { $unwind: '$guest' },
        ...(guestLookupMatches.length ? [{ $match: { $and: guestLookupMatches } }] : []),
        {
          $match: {
            assignedTo: { $ne: null },
          },
        },
        { $count: 'total' },
      ]),
    ]);

    return {
      items,
      pagination: {
        page: safePage,
        pageSize: safeLimit,
        total,
        totalPages,
      },
      summary: {
        todayCount,
        completionRate: total ? Math.round((completedCardsCount / total) * 100) : 0,
        assignedFollowUpCount: assignedFollowUpCountRaw[0]?.total ?? 0,
      },
    };
  }

  async findOne(id: string, currentUser?: AuthUser) {
    const guest = await this.guestModel.findById(id).populate('branchId').lean();
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }
    await this.ensureGuestScope(guest, currentUser);
    return guest;
  }

  async update(id: string, dto: UpdateGuestDto, currentUser: AuthUser) {
    await this.findOne(id, currentUser);
    const scopedBranchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);
    const guest = await this.guestModel
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        },
        { new: true },
      )
      .populate('branchId')
      .lean();
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }
    return guest;
  }

  async findDuplicates(currentUser: AuthUser, branchId?: string) {
    const guests = await this.guestModel
      .find(await this.accessScopeService.buildBranchFilter(currentUser, branchId))
      .populate('branchId')
      .sort({ createdAt: -1 })
      .lean();

    const groups = new Map<string, typeof guests>();

    for (const guest of guests) {
      const emailKey = guest.email?.trim().toLowerCase();
      const phoneKey = this.getNormalizedPhone(guest.phone);
      const keys = [emailKey ? `email:${emailKey}` : '', phoneKey ? `phone:${phoneKey}` : ''].filter(Boolean);

      for (const key of keys) {
        const existing = groups.get(key) ?? [];
        existing.push(guest);
        groups.set(key, existing);
      }
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const uniqueItems = Array.from(new Map(items.map((item) => [String(item._id), item])).values());
        return {
          key,
          type: key.startsWith('email:') ? 'email' : 'phone',
          value: key.replace(/^(email:|phone:)/, ''),
          guests: uniqueItems,
        };
      })
      .sort((a, b) => b.guests.length - a.guests.length);
  }

  async mergeGuests(targetGuestId: string, sourceGuestId: string, currentUser: AuthUser) {
    if (targetGuestId === sourceGuestId) {
      throw new BadRequestException('Select two different guests to merge');
    }

    const [target, source] = await Promise.all([
      this.guestModel.findById(targetGuestId),
      this.guestModel.findById(sourceGuestId),
    ]);

    if (!target || !source) {
      throw new NotFoundException('One or more guests were not found');
    }

    await this.ensureGuestScope(target.toObject(), currentUser);
    await this.ensureGuestScope(source.toObject(), currentUser);

    if (String(target.branchId) !== String(source.branchId)) {
      throw new BadRequestException('Guests must belong to the same branch to merge');
    }

    const mergedPayload = this.mergeGuestPayload(target, source);

    await Promise.all([
      this.visitModel.updateMany({ guestId: source._id }, { guestId: target._id, branchId: target.branchId }),
      this.followUpModel.updateMany({ guestId: source._id }, { guestId: target._id }),
      this.attendanceModel.updateMany({ guestId: source._id }, { guestId: target._id, branchId: target.branchId }),
      this.communicationModel.updateMany({ guestId: source._id }, { guestId: target._id }),
      this.memberModel.updateMany({ guestId: source._id }, { guestId: target._id, branchId: target.branchId }),
    ]);

    await this.guestModel.findByIdAndUpdate(target._id, mergedPayload);
    await this.guestModel.findByIdAndDelete(source._id);

    return this.findOne(String(target._id), currentUser);
  }
}
