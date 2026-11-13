import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isEmail } from 'class-validator';
import { AccessScopeService } from '../access-scope/access-scope.service';
import {
  Attendance,
  AttendanceDocument,
} from '../attendance/schemas/attendance.schema';
import {
  Communication,
  CommunicationDocument,
} from '../communications/schemas/communication.schema';
import { BRANCH_LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  FollowUp,
  FollowUpDocument,
} from '../follow-ups/schemas/follow-up.schema';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { PushService } from '../push/push.service';
import { VisitsService } from '../visits/visits.service';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { CreateGuestDto, UpdateGuestDto } from './dto/create-guest.dto';
import { Guest, GuestDocument } from './schemas/guest.schema';
import { GuestFieldsService, type GuestAnswer } from './guest-fields.service';
import { identityKeys } from '../imports/import.logic';

export class DuplicateGuestError extends BadRequestException {
  constructor() {
    super('Guest with this phone or email already exists');
  }
}

@Injectable()
export class GuestsService {
  constructor(
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    @InjectModel(FollowUp.name)
    private readonly followUpModel: Model<FollowUpDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Communication.name)
    private readonly communicationModel: Model<CommunicationDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private readonly visitsService: VisitsService,
    private readonly followUpsService: FollowUpsService,
    private readonly accessScopeService: AccessScopeService,
    private readonly pushService: PushService,
    private readonly guestFields: GuestFieldsService,
  ) {}

  /** Lets the branch's leaders and follow-up team know someone new just walked in. */
  private announceNewGuest(
    guest: {
      id: string;
      firstName: string;
      lastName: string;
      visitStatus?: string;
    },
    branchId: string,
    currentUser?: AuthUser,
  ) {
    const firstVisit = (guest.visitStatus ?? 'first_time') === 'first_time';
    void this.pushService
      .branchName(branchId)
      .then((branchName) => {
        const label = firstVisit ? 'New first-timer' : 'New guest';
        this.pushService.notifyBranchTeam(
          branchId,
          [...BRANCH_LEADERSHIP_ROLES, 'follow_up'],
          {
            title: branchName ? `${label} at ${branchName}` : label,
            body: `${guest.firstName} ${guest.lastName} just registered. Tap to welcome them.`,
            url: `/guests/${guest.id}`,
            tag: `new-guests-${branchId}`,
          },
          currentUser?.sub,
        );
      })
      .catch(() => undefined);
  }

  private async ensureGuestScope(
    guest: { branchId?: unknown },
    currentUser?: AuthUser,
  ) {
    if (!currentUser) {
      return;
    }

    const branchValue =
      typeof guest.branchId === 'string'
        ? guest.branchId
        : typeof guest.branchId === 'object' &&
            guest.branchId !== null &&
            '_id' in guest.branchId
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
    const nextChildren = Array.from(
      new Set([...(target.children ?? []), ...(source.children ?? [])]),
    );

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
      visitStatus:
        target.visitStatus === 'member' || source.visitStatus === 'member'
          ? 'member'
          : target.visitStatus || source.visitStatus,
      invitedBy: target.invitedBy || source.invitedBy,
      heardAboutChurch: target.heardAboutChurch || source.heardAboutChurch,
      wantsPastoralCall: target.prayerRequest ? target.wantsPastoralCall : source.prayerRequest ? source.wantsPastoralCall : target.wantsPastoralCall || source.wantsPastoralCall,
      salvationResponse: target.salvationResponse || source.salvationResponse,
      convertedToMember: target.convertedToMember || source.convertedToMember,
    };
  }

  async create(input: CreateGuestDto, currentUser?: AuthUser, publicAnswers?: GuestAnswer[]) {
    const { customFields, formRevision, confirmDistinctGuest, ...dto } = input;
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);
    let customAnswers = publicAnswers;
    if (currentUser) {
      const definition = await this.guestFields.get('guest', branchId);
      this.guestFields.checkRevision(definition, formRevision);
      const data = dto as Record<string, unknown>;
      for (const key of definition.hiddenStaff) delete data[key];
      customAnswers = this.guestFields.collect(definition, 'staff', customFields);
    }
    dto.firstName = dto.firstName.trim().replace(/\s+/g, ' ');
    dto.lastName = dto.lastName.trim().replace(/\s+/g, ' ');
    dto.phone = dto.phone?.trim() ?? '';
    dto.email = dto.email?.trim().toLowerCase() || undefined;
    if (!dto.firstName || !dto.lastName) throw new BadRequestException('First and last names are required.');
    if (dto.email && !isEmail(dto.email)) throw new BadRequestException('Enter a valid email address.');
    if (dto.phone && (!/^[+\d() .-]{7,50}$/.test(dto.phone) || !/^\d{7,15}$/.test(dto.phone.replace(/\D/g, '')))) {
      throw new BadRequestException('Enter a phone number with 7–15 digits.');
    }
    const keys = identityKeys(dto, 'guests');
    const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = (value: string) => new RegExp('^\\s*' + value.split(' ').map(literal).join('\\s+') + '\\s*$', 'i');
    const candidates = await this.guestModel.find({ branchId, $or: [
      { firstName: namePattern(dto.firstName), lastName: namePattern(dto.lastName) },
      ...(dto.email ? [{ email: new RegExp('^\\s*' + literal(dto.email) + '\\s*$', 'i') }] : []),
      ...keys.filter((key) => key.startsWith('phone:')).map((key) => ({
        phone: new RegExp(key.slice(6).split('').join('\\D*') + '\\D*$'),
      })),
    ] }).select('firstName lastName phone email').lean();
    const matches = candidates.map((guest) => ({ guest, keys: identityKeys(guest, 'guests') }))
      .filter((candidate) => candidate.keys.some((key) => keys.includes(key)));
    const phoneIdentity = (phone?: string) => {
      const digits = phone?.replace(/\D/g, '') ?? '';
      return /^1\d{10}$/.test(digits) ? digits.slice(1) : digits;
    };
    const exact = matches.filter((candidate) =>
      keys.some((key) => key.startsWith('name:') && candidate.keys.includes(key)) &&
      (!dto.phone || !candidate.guest.phone || phoneIdentity(dto.phone) === phoneIdentity(candidate.guest.phone)) &&
      (!dto.email || !candidate.guest.email || dto.email === candidate.guest.email.trim().toLowerCase()) &&
      (Boolean(dto.phone && candidate.guest.phone) || Boolean(dto.email && candidate.guest.email)));
    const existing = matches.length === 1 && exact.length === 1 ? exact[0].guest : undefined;
    if (!currentUser && existing) throw new DuplicateGuestError();
    if (currentUser && matches.length && (existing || !confirmDistinctGuest)) {
      throw new ConflictException({
        code: existing ? 'guest_already_exists' : 'guest_possible_match',
        message: existing ? 'This guest is already registered.' : 'A guest with a similar name or shared contact already exists.',
        ...(existing ? { guestId: String(existing._id) } : {}),
      });
    }

    const guest = await this.guestModel.create({
      ...dto,
      ...(customAnswers?.length ? { customAnswers } : {}),
      branchId,
      visitStatus: dto.visitStatus ?? 'first_time',
    });

    await this.visitsService.create(
      {
        branchId: branchId!,
        guestId: guest.id,
        visitDate: dto.visitDate ?? new Date().toISOString(),
        serviceType: dto.serviceType ?? 'Sunday service',
        notes: 'Auto-created from guest registration',
      },
      currentUser,
    );

    await this.followUpsService.create(
      {
        guestId: guest.id,
        assignedTo: dto.assignedFollowUpUserId,
        status: dto.assignedFollowUpUserId ? 'assigned' : 'new',
        contactMethod: 'registration',
        note: 'Guest registered and follow-up record created.',
      },
      currentUser,
    );

    if (branchId) {
      this.announceNewGuest(
        {
          id: String(guest._id),
          firstName: guest.firstName,
          lastName: guest.lastName,
          visitStatus: guest.visitStatus,
        },
        branchId,
        currentUser,
      );
    }

    return this.findOne(guest.id, currentUser);
  }

  async findAll(
    currentUser: AuthUser,
    branchId?: string,
    search?: string,
    page = 1,
    limit = 20,
    sort = 'newest',
  ) {
    const safeLimit = Math.min(Math.max(limit || 20, 1), 100);
    const requestedPage = Math.max(page || 1, 1);
    const searchConditions = this.buildGuestSearchConditions(search);
    const documentQuery: Record<string, unknown> = {
      ...(await this.accessScopeService.buildBranchFilter(
        currentUser,
        branchId,
      )),
    };
    const aggregateQuery: Record<string, unknown> = {
      ...documentQuery,
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
      documentQuery as {
        branchId?:
          | Types.ObjectId
          | string
          | { $in: Array<Types.ObjectId | string> };
      }
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

    const directorySorts: Record<string, Record<string, 1 | -1>> = {
      newest: { createdAt: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
      name_asc: { firstName: 1, lastName: 1, _id: 1 },
      name_desc: { firstName: -1, lastName: -1, _id: -1 },
    };
    const [items, assignedFollowUpCountRaw] = await Promise.all([
      this.guestModel
        .aggregate([
          { $match: aggregateQuery },
          { $sort: directorySorts[sort] || directorySorts.newest },
          { $skip: skip },
          { $limit: safeLimit },
          {
            $lookup: {
              from: 'branches',
              let: { branchRef: '$branchId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $or: [
                        { $eq: ['$_id', '$$branchRef'] },
                        {
                          $eq: [
                            { $toString: '$_id' },
                            { $toString: '$$branchRef' },
                          ],
                        },
                        { $eq: ['$name', '$$branchRef'] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
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
        ])
        .collation({ locale: 'en', strength: 2 }),
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
        ...(guestLookupMatches.length
          ? [{ $match: { $and: guestLookupMatches } }]
          : []),
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
        completionRate: total
          ? Math.round((completedCardsCount / total) * 100)
          : 0,
        assignedFollowUpCount: assignedFollowUpCountRaw[0]?.total ?? 0,
      },
    };
  }

  async findOne(id: string, currentUser?: AuthUser) {
    const guest = await this.guestModel
      .findById(id)
      .select('+customAnswers')
      .populate('branchId')
      .lean();
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }
    await this.ensureGuestScope(guest, currentUser);
    return guest;
  }

  async update(id: string, dto: UpdateGuestDto, currentUser: AuthUser) {
    const existing = await this.findOne(id, currentUser);
    const scopedBranchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId,
    );
    const existingBranch = existing.branchId?._id ?? existing.branchId;
    const moving = scopedBranchId && scopedBranchId !== String(existingBranch);
    const guest = await this.guestModel
      .findOneAndUpdate(
        { _id: id, ...(moving ? { prayerRequest: { $not: /\S/ } } : {}) },
        {
          ...dto,
          ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        },
        { new: true },
      )
      .populate('branchId')
      .lean();
    if (!guest) {
      if (moving) throw new BadRequestException('A guest with a private prayer request cannot be transferred to another branch.');
      throw new NotFoundException('Guest not found');
    }
    return guest;
  }

  async findDuplicates(currentUser: AuthUser, branchId?: string) {
    const guests = await this.guestModel
      .find(
        await this.accessScopeService.buildBranchFilter(currentUser, branchId),
      )
      .populate('branchId')
      .sort({ createdAt: -1 })
      .lean();

    const groups = new Map<string, typeof guests>();

    for (const guest of guests) {
      const emailKey = guest.email?.trim().toLowerCase();
      const phoneKey = this.getNormalizedPhone(guest.phone);
      const keys = [
        emailKey ? `email:${emailKey}` : '',
        phoneKey ? `phone:${phoneKey}` : '',
      ].filter(Boolean);

      for (const key of keys) {
        const existing = groups.get(key) ?? [];
        existing.push(guest);
        groups.set(key, existing);
      }
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const uniqueItems = Array.from(
          new Map(items.map((item) => [String(item._id), item])).values(),
        );
        return {
          key,
          type: key.startsWith('email:') ? 'email' : 'phone',
          value: key.replace(/^(email:|phone:)/, ''),
          guests: uniqueItems,
        };
      })
      .sort((a, b) => b.guests.length - a.guests.length);
  }

  async mergeGuests(
    targetGuestId: string,
    sourceGuestId: string,
    currentUser: AuthUser,
  ) {
    if (targetGuestId === sourceGuestId) {
      throw new BadRequestException('Select two different guests to merge');
    }

    const [target, source] = await Promise.all([
      this.guestModel.findById(targetGuestId).select('+customAnswers +prayerRequest'),
      this.guestModel.findById(sourceGuestId).select('+customAnswers +prayerRequest +prayerCareStatus +prayerCareAssigneeId +prayerCareRevision +prayerCareUpdatedAt +prayerCareDueDate +prayerCareTimeline'),
    ]);

    if (!target || !source) {
      throw new NotFoundException('One or more guests were not found');
    }

    await this.ensureGuestScope(target.toObject(), currentUser);
    await this.ensureGuestScope(source.toObject(), currentUser);

    if (String(target.branchId) !== String(source.branchId)) {
      throw new BadRequestException(
        'Guests must belong to the same branch to merge',
      );
    }
    if (target.prayerRequest?.trim() && source.prayerRequest?.trim()) {
      throw new BadRequestException('Both guests have private prayer requests. The records cannot be merged.');
    }

    const mergedPayload = this.mergeGuestPayload(target, source);

    await Promise.all([
      this.visitModel.updateMany(
        { guestId: source._id },
        { guestId: target._id, branchId: target.branchId },
      ),
      this.followUpModel.updateMany(
        { guestId: source._id },
        { guestId: target._id },
      ),
      this.attendanceModel.updateMany(
        { guestId: source._id },
        { guestId: target._id, branchId: target.branchId },
      ),
      this.communicationModel.updateMany(
        { guestId: source._id },
        { guestId: target._id },
      ),
      this.memberModel.updateMany(
        { guestId: source._id },
        { guestId: target._id, branchId: target.branchId },
      ),
    ]);

    const customAnswers = [...new Map(
      [...(source.customAnswers ?? []), ...(target.customAnswers ?? [])].map((answer) => [answer.key, answer]),
    ).values()];
    await this.guestModel.findByIdAndUpdate(target._id, {
      ...mergedPayload,
      ...(!target.prayerRequest && source.prayerRequest ? {
        prayerRequest: source.prayerRequest,
        prayerCareStatus: source.prayerCareStatus,
        prayerCareAssigneeId: source.prayerCareAssigneeId,
        prayerCareRevision: source.prayerCareRevision,
        prayerCareUpdatedAt: source.prayerCareUpdatedAt,
        prayerCareDueDate: source.prayerCareDueDate,
        prayerCareTimeline: source.prayerCareTimeline,
      } : {}),
      ...(customAnswers.length ? { customAnswers } : {}),
    });
    await this.guestModel.findByIdAndDelete(source._id);

    return this.findOne(String(target._id), currentUser);
  }
}
