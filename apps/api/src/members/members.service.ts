import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { GuestsService } from '../guests/guests.service';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { ServiceUnit, ServiceUnitDocument } from '../service-units/schemas/service-unit.schema';
import { CreateMemberDto, UpdateMemberDto } from './dto/create-member.dto';
import { Member, MemberDocument } from './schemas/member.schema';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(ServiceUnit.name) private readonly serviceUnitModel: Model<ServiceUnitDocument>,
    private readonly guestsService: GuestsService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeEmail(value?: string) {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : undefined;
  }

  private normalizeYesNo(value?: string) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (['yes', 'received', 'completed', 'in_progress'].includes(normalized)) {
      return 'yes';
    }

    if (['no', 'not_started', 'not_yet'].includes(normalized)) {
      return 'no';
    }

    return normalized;
  }

  private validatePastOrTodayDate(label: string, value?: string) {
    if (!value) {
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} must be a valid date`);
    }

    const today = new Date();
    const maxDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;

    if (value > maxDate) {
      throw new BadRequestException(`${label} cannot be in the future`);
    }
  }

  private normalizeMemberPayload(dto: Partial<CreateMemberDto>) {
    return {
      ...dto,
      firstName: this.normalizeText(dto.firstName),
      lastName: this.normalizeText(dto.lastName),
      title: this.normalizeText(dto.title),
      phone: this.normalizeText(dto.phone),
      email: this.normalizeEmail(dto.email),
      familyDetails: this.normalizeText(dto.familyDetails),
      membershipStatus: this.normalizeText(dto.membershipStatus),
      dateJoinedChurch: this.normalizeText(dto.dateJoinedChurch),
      believerFoundationClassStatus: this.normalizeYesNo(dto.believerFoundationClassStatus),
      believerFoundationClassDate: this.normalizeText(dto.believerFoundationClassDate),
      believerFoundationClassLocation: this.normalizeText(dto.believerFoundationClassLocation),
      bccStatus: this.normalizeYesNo(dto.bccStatus),
      bccDate: this.normalizeText(dto.bccDate),
      bccLocation: this.normalizeText(dto.bccLocation),
      lccStatus: this.normalizeYesNo(dto.lccStatus),
      lccDate: this.normalizeText(dto.lccDate),
      lccLocation: this.normalizeText(dto.lccLocation),
      lcdStatus: this.normalizeYesNo(dto.lcdStatus),
      lcdDate: this.normalizeText(dto.lcdDate),
      lcdLocation: this.normalizeText(dto.lcdLocation),
      holySpiritBaptismStatus: this.normalizeYesNo(dto.holySpiritBaptismStatus),
      waterBaptismStatus: this.normalizeYesNo(dto.waterBaptismStatus),
      serviceUnitInterest: this.normalizeText(dto.serviceUnitInterest),
    };
  }

  private validateMemberPayload(dto: Partial<CreateMemberDto>) {
    if (
      dto.title &&
      !['bro', 'sister', 'pastor', 'deacon', 'deaconess', 'apostle', 'other'].includes(
        dto.title.toLowerCase(),
      )
    ) {
      throw new BadRequestException(
        'Member title must be bro, sister, pastor, deacon, deaconess, apostle, or other',
      );
    }

    if (dto.membershipStatus && !['active', 'new_member', 'worker', 'inactive'].includes(dto.membershipStatus)) {
      throw new BadRequestException('Membership status must be active, new_member, worker, or inactive');
    }

    for (const [label, value] of [
      ['Date joined the church', dto.dateJoinedChurch],
      ['Believers Foundation Class date', dto.believerFoundationClassDate],
      ['BCC date', dto.bccDate],
      ['LCC date', dto.lccDate],
      ['LCD date', dto.lcdDate],
    ] as const) {
      this.validatePastOrTodayDate(label, value);
    }

    for (const [label, value] of [
      ['Believers Foundation Class status', dto.believerFoundationClassStatus],
      ['BCC status', dto.bccStatus],
      ['LCC status', dto.lccStatus],
      ['LCD status', dto.lcdStatus],
      ['Holy Spirit baptism status', dto.holySpiritBaptismStatus],
      ['Water baptism status', dto.waterBaptismStatus],
    ] as const) {
      if (value && !['yes', 'no'].includes(value)) {
        throw new BadRequestException(`${label} must be yes or no`);
      }
    }
  }

  private async ensureUniqueIdentity(
    dto: Pick<Partial<CreateMemberDto>, 'firstName' | 'lastName' | 'phone' | 'email'>,
    branchId?: string,
    currentId?: string,
  ) {
    const firstName = dto.firstName?.trim();
    const lastName = dto.lastName?.trim();
    const phone = dto.phone?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (!firstName || !lastName || (!phone && !email)) {
      return;
    }

    const query: Record<string, unknown> = {
      ...(branchId ? { branchId } : {}),
      ...(currentId ? { _id: { $ne: currentId } } : {}),
      firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
      lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
    };

    if (phone && email) {
      query.$or = [{ phone }, { email }];
    } else if (phone) {
      query.phone = phone;
    } else if (email) {
      query.email = email;
    }

    const existing = await this.memberModel.findOne(query).lean();

    if (existing) {
      throw new BadRequestException('A member with the same name and phone/email already exists');
    }
  }

  private async resolveServiceUnitAssignment(
    branchId: string | undefined,
    payload: Pick<CreateMemberDto, 'serviceUnitId' | 'serviceUnitInterest'>,
  ) {
    const requestedServiceUnitId =
      typeof payload.serviceUnitId === 'string' ? payload.serviceUnitId.trim() : undefined;
    const requestedServiceUnitName =
      typeof payload.serviceUnitInterest === 'string' ? payload.serviceUnitInterest.trim() : undefined;

    if (!branchId) {
      return {
        serviceUnitId: undefined,
        serviceUnitInterest: requestedServiceUnitName,
      };
    }

    if (requestedServiceUnitId) {
      const serviceUnit = await this.serviceUnitModel.findById(requestedServiceUnitId).lean();

      if (!serviceUnit) {
        throw new BadRequestException('Selected service unit was not found');
      }

      if (String(serviceUnit.branchId) !== branchId) {
        throw new BadRequestException('Selected service unit must belong to the same branch');
      }

      return {
        serviceUnitId: serviceUnit._id,
        serviceUnitInterest: serviceUnit.name,
      };
    }

    if (requestedServiceUnitName) {
      const serviceUnit = await this.serviceUnitModel.findOne({
        branchId,
        name: { $regex: new RegExp(`^${this.escapeRegExp(requestedServiceUnitName)}$`, 'i') },
      });

      return {
        serviceUnitId: serviceUnit?._id,
        serviceUnitInterest: serviceUnit?.name ?? requestedServiceUnitName,
      };
    }

    return {
      serviceUnitId: undefined,
      serviceUnitInterest: undefined,
    };
  }

  async create(dto: CreateMemberDto, currentUser?: AuthUser) {
    const normalizedDto = this.normalizeMemberPayload(dto);
    this.validateMemberPayload(normalizedDto);
    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      normalizedDto.branchId,
    );

    if (normalizedDto.guestId && currentUser) {
      const guest = await this.guestsService.findOne(normalizedDto.guestId, currentUser);
      await this.accessScopeService.ensureBranchAccess(
        currentUser,
        typeof guest.branchId === 'object' && guest.branchId !== null && '_id' in guest.branchId
          ? String((guest.branchId as { _id?: unknown })._id ?? '')
          : String(guest.branchId ?? ''),
      );
    }

    await this.ensureUniqueIdentity(normalizedDto, branchId);
    const serviceUnitAssignment = await this.resolveServiceUnitAssignment(branchId, normalizedDto);

    return this.memberModel.create({
      ...normalizedDto,
      branchId,
      ...serviceUnitAssignment,
    });
  }

  async findAll(currentUser: AuthUser, branchId?: string) {
    return this.memberModel
      .find(await this.accessScopeService.buildBranchFilter(currentUser, branchId))
      .populate('branchId')
      .populate('guestId')
      .populate('serviceUnitId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string, currentUser: AuthUser) {
    const member = await this.memberModel.findById(id).populate('branchId').populate('guestId').populate('serviceUnitId').lean();
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    const branchValue =
      typeof member.branchId === 'object' && member.branchId !== null && '_id' in member.branchId
        ? String((member.branchId as { _id?: unknown })._id ?? '')
        : String(member.branchId ?? '');
    await this.accessScopeService.ensureBranchAccess(currentUser, branchValue);
    return member;
  }

  async update(id: string, dto: UpdateMemberDto, currentUser: AuthUser) {
    const existing = await this.findOne(id, currentUser);
    const normalizedDto = this.normalizeMemberPayload(dto);
    this.validateMemberPayload(normalizedDto);
    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      normalizedDto.branchId,
    );
    await this.ensureUniqueIdentity(
      {
        firstName: normalizedDto.firstName ?? existing.firstName,
        lastName: normalizedDto.lastName ?? existing.lastName,
        phone: normalizedDto.phone ?? existing.phone,
        email: normalizedDto.email ?? existing.email,
      },
      branchId ?? (existing.branchId?._id ? String(existing.branchId._id) : undefined),
      id,
    );
    const hasServiceUnitPayload =
      Object.prototype.hasOwnProperty.call(normalizedDto, 'serviceUnitId') ||
      Object.prototype.hasOwnProperty.call(normalizedDto, 'serviceUnitInterest');
    const serviceUnitAssignment = hasServiceUnitPayload
      ? await this.resolveServiceUnitAssignment(
          branchId ?? (existing.branchId?._id ? String(existing.branchId._id) : undefined),
          {
            serviceUnitId: normalizedDto.serviceUnitId,
            serviceUnitInterest: normalizedDto.serviceUnitInterest,
          },
        )
      : null;
    const member = await this.memberModel
      .findByIdAndUpdate(
        id,
        {
          ...normalizedDto,
          ...(branchId ? { branchId } : {}),
          ...(serviceUnitAssignment ?? {}),
        },
        { new: true },
      )
      .populate('branchId')
      .populate('guestId')
      .populate('serviceUnitId')
      .lean();
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  async convertGuest(guestId: string, currentUser: AuthUser) {
    const guest = await this.guestsService.findOne(guestId, currentUser);
    const branchId =
      typeof guest.branchId === 'object' && guest.branchId !== null && '_id' in guest.branchId
        ? String((guest.branchId as { _id?: unknown })._id)
        : String(guest.branchId);
    const member = await this.memberModel.create({
      guestId,
      branchId,
      firstName: guest.firstName,
      lastName: guest.lastName,
      phone: guest.phone,
      email: guest.email,
      membershipStatus: 'active',
      believerFoundationClassStatus: 'no',
      bccStatus: 'no',
      lccStatus: 'no',
      lcdStatus: 'no',
      holySpiritBaptismStatus: 'no',
      waterBaptismStatus: 'no',
    });
    await this.guestModel.findByIdAndUpdate(guestId, {
      convertedToMember: true,
      visitStatus: 'member',
    });
    return this.findOne(member.id, currentUser);
  }
}
