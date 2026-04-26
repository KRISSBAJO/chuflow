import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Guest, GuestDocument } from '../guests/schemas/guest.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { ServiceSchedulesService } from '../service-schedules/service-schedules.service';
import { ServiceType, ServiceTypeDocument } from '../service-types/schemas/service-type.schema';
import { CreateAttendanceDto, UpdateAttendanceDto } from './dto/create-attendance.dto';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Guest.name) private readonly guestModel: Model<GuestDocument>,
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(ServiceType.name) private readonly serviceTypeModel: Model<ServiceTypeDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly serviceSchedulesService: ServiceSchedulesService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private validatePastOrTodayServiceDate(value: string | Date) {
    const serviceDate = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(serviceDate.getTime())) {
      throw new BadRequestException('Service date must be a valid date');
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (serviceDate.getTime() > endOfToday.getTime()) {
      throw new BadRequestException('Service date cannot be in the future');
    }

    return serviceDate;
  }

  private validateSummaryCounts(dto: Partial<CreateAttendanceDto>) {
    for (const [label, value] of [
      ['Men count', dto.menCount],
      ['Women count', dto.womenCount],
      ['Children count', dto.childrenCount],
      ['Adults count', dto.adultsCount],
      ['First timers count', dto.firstTimersCount],
      ['New converts count', dto.newConvertsCount],
      ['Holy Spirit baptism count', dto.holySpiritBaptismCount],
    ] as const) {
      if (value !== undefined && value < 0) {
        throw new BadRequestException(`${label} cannot be negative`);
      }
    }

    if (
      dto.firstTimersCount !== undefined &&
      dto.adultsCount !== undefined &&
      dto.firstTimersCount > dto.adultsCount
    ) {
      throw new BadRequestException('First timers cannot be greater than total adults');
    }

    if (
      dto.newConvertsCount !== undefined &&
      dto.adultsCount !== undefined &&
      dto.newConvertsCount > dto.adultsCount
    ) {
      throw new BadRequestException('New converts cannot be greater than total adults');
    }
  }

  private async resolveServiceTypeAssignment(
    branchId: string | undefined,
    dto: Pick<CreateAttendanceDto, 'serviceTypeId' | 'serviceType' | 'serviceTypeLabel'>,
  ) {
    const serviceTypeId =
      typeof dto.serviceTypeId === 'string' ? dto.serviceTypeId.trim() : undefined;
    const serviceTypeValue =
      typeof dto.serviceType === 'string' ? dto.serviceType.trim() : undefined;
    const serviceTypeLabel =
      typeof dto.serviceTypeLabel === 'string' ? dto.serviceTypeLabel.trim() : undefined;

    if (!branchId) {
      if (!serviceTypeValue && !serviceTypeLabel) {
        throw new ForbiddenException('A service type is required');
      }

      return {
        serviceType: this.slugify(serviceTypeValue || serviceTypeLabel || 'service'),
        serviceTypeLabel: serviceTypeLabel || serviceTypeValue,
        serviceTypeId: undefined,
      };
    }

    if (serviceTypeId) {
      const serviceType = await this.serviceTypeModel.findById(serviceTypeId).lean();

      if (!serviceType) {
        throw new NotFoundException('Service type not found');
      }

      if (String(serviceType.branchId) !== String(branchId)) {
        throw new ForbiddenException('Attendance service type must belong to the same branch');
      }

      return {
        serviceType: serviceType.key,
        serviceTypeLabel: serviceType.name,
        serviceTypeId: serviceType._id,
      };
    }

    const searchValue = serviceTypeLabel || serviceTypeValue;

    if (!searchValue) {
      throw new ForbiddenException('A service type is required');
    }

    const normalizedValue = searchValue.trim();

    const serviceType = await this.serviceTypeModel.findOne({
      branchId,
      $or: [
        { key: { $regex: new RegExp(`^${this.slugify(normalizedValue)}$`, 'i') } },
        { name: { $regex: new RegExp(`^${normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    }).lean();

    if (serviceType) {
      return {
        serviceType: serviceType.key,
        serviceTypeLabel: serviceType.name,
        serviceTypeId: serviceType._id,
      };
    }

    return {
      serviceType: this.slugify(serviceTypeValue || normalizedValue),
      serviceTypeLabel: serviceTypeLabel || normalizedValue,
      serviceTypeId: undefined,
    };
  }

  private async resolveServiceContext(
    currentUser: AuthUser | undefined,
    branchId: string | undefined,
    dto: Pick<
      CreateAttendanceDto,
      | 'serviceDate'
      | 'serviceTypeId'
      | 'serviceType'
      | 'serviceTypeLabel'
      | 'serviceName'
      | 'serviceScheduleId'
      | 'serviceInstanceId'
    >,
  ) {
    if (!currentUser || !branchId) {
      return {
        ...(await this.resolveServiceTypeAssignment(branchId, dto)),
        serviceName: dto.serviceName?.trim() || undefined,
      };
    }

    const serviceInstance = await this.serviceSchedulesService.resolveServiceInstanceForEntry({
      currentUser,
      branchId,
      serviceDate: dto.serviceDate,
      serviceScheduleId: dto.serviceScheduleId,
      serviceInstanceId: dto.serviceInstanceId,
    });

    if (!serviceInstance) {
      return {
        ...(await this.resolveServiceTypeAssignment(branchId, dto)),
        serviceName: dto.serviceName?.trim() || undefined,
      };
    }

    const resolvedTypeId =
      typeof serviceInstance.serviceTypeId === 'object' &&
      serviceInstance.serviceTypeId !== null &&
      '_id' in serviceInstance.serviceTypeId
        ? String((serviceInstance.serviceTypeId as { _id?: unknown })._id ?? '')
        : String(serviceInstance.serviceTypeId);
    const resolvedScheduleId =
      typeof serviceInstance.serviceScheduleId === 'object' &&
      serviceInstance.serviceScheduleId !== null &&
      '_id' in serviceInstance.serviceScheduleId
        ? String((serviceInstance.serviceScheduleId as { _id?: unknown })._id ?? '')
        : serviceInstance.serviceScheduleId
          ? String(serviceInstance.serviceScheduleId)
          : undefined;

    return {
      serviceType: serviceInstance.serviceTypeKey,
      serviceTypeLabel: serviceInstance.serviceTypeLabel,
      serviceTypeId: resolvedTypeId || undefined,
      serviceScheduleId: resolvedScheduleId,
      serviceInstanceId: String(serviceInstance._id),
      serviceName:
        dto.serviceName?.trim() ||
        serviceInstance.serviceScheduleName ||
        serviceInstance.serviceTypeLabel,
    };
  }

  private async validatePersonScope(
    currentUser: AuthUser | undefined,
    branchId: string | undefined,
    dto: { personType?: string; guestId?: string; memberId?: string },
  ) {
    if (dto.personType === 'guest' && dto.guestId) {
      const guest = await this.guestModel.findById(dto.guestId).lean();
      if (!guest) {
        throw new NotFoundException('Guest not found');
      }
      if (String(guest.branchId) !== String(branchId)) {
        throw new ForbiddenException('Attendance guest must belong to the same branch');
      }
    }

    if (dto.personType === 'member' && dto.memberId) {
      const member = await this.memberModel.findById(dto.memberId).lean();
      if (!member) {
        throw new NotFoundException('Member not found');
      }
      if (String(member.branchId) !== String(branchId)) {
        throw new ForbiddenException('Attendance member must belong to the same branch');
      }
    }
  }

  async create(dto: CreateAttendanceDto, currentUser?: AuthUser) {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);
    const entryMode = dto.entryMode ?? 'individual';
    const serviceDate = this.validatePastOrTodayServiceDate(dto.serviceDate);
    const serviceContext = await this.resolveServiceContext(currentUser, branchId, dto);

    if (entryMode === 'individual') {
      await this.validatePersonScope(currentUser, branchId, dto);
    } else {
      this.validateSummaryCounts(dto);
    }

    const attendance = await this.attendanceModel.create({
      ...dto,
      entryMode,
      branchId,
      ...serviceContext,
      serviceDate,
    });

    if (serviceContext.serviceInstanceId) {
      await this.serviceSchedulesService.touchServiceInstance(
        serviceContext.serviceInstanceId,
        'attendance',
      );
    }

    await this.auditLogsService.record({
      entityType: 'attendance',
      entityId: String(attendance._id),
      action: 'created',
      summary: `${entryMode === 'summary' ? 'Attendance summary' : 'Attendance record'} created for ${
        serviceContext.serviceName || serviceContext.serviceTypeLabel || serviceContext.serviceType
      }`,
      actor: currentUser,
      actorRole: currentUser?.role ?? 'public_submission',
      branchId,
      metadata: {
        entryMode,
        serviceDate,
        personType: dto.personType,
        serviceType: serviceContext.serviceType,
        serviceName: serviceContext.serviceName,
      },
    });

    return attendance;
  }

  list(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      serviceType?: string;
      personType?: string;
      entryMode?: string;
      serviceName?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const buildQuery = async () => {
      const query: Record<string, unknown> = Object.fromEntries(
      Object.entries({
        ...(await this.accessScopeService.buildBranchFilter(currentUser, filters.branchId)),
        ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
        ...(filters.personType ? { personType: filters.personType } : {}),
        ...(filters.entryMode ? { entryMode: filters.entryMode } : {}),
      }).filter(([, value]) => value),
    );

      if (filters.serviceName) {
        query.serviceName = { $regex: filters.serviceName, $options: 'i' };
      }

      if (filters.search) {
        query.$or = [
          { serviceName: { $regex: filters.search, $options: 'i' } },
          { serviceTypeLabel: { $regex: filters.search, $options: 'i' } },
          { serviceType: { $regex: filters.search, $options: 'i' } },
        ];
      }

      if (filters.dateFrom || filters.dateTo) {
        query.serviceDate = {
          ...(filters.dateFrom ? { $gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { $lte: new Date(filters.dateTo) } : {}),
        };
      }

      return query;
    };

    return buildQuery().then((query) =>
      this.attendanceModel
        .find(query)
        .populate('branchId')
        .populate('serviceTypeId')
        .populate('serviceScheduleId')
        .populate('serviceInstanceId')
        .populate('guestId')
        .populate('memberId')
        .sort({ serviceDate: -1 })
        .lean(),
    );
  }

  async summary(currentUser: AuthUser, branchId?: string) {
    const matchStage = await this.accessScopeService.buildBranchFilter(currentUser, branchId);
    const result = await this.attendanceModel.aggregate([
      { $match: { ...matchStage, entryMode: 'individual' } },
      {
        $group: {
          _id: { $ifNull: ['$serviceTypeLabel', '$serviceType'] },
          total: { $sum: 1 },
          guests: {
            $sum: { $cond: [{ $eq: ['$personType', 'guest'] }, 1, 0] },
          },
          members: {
            $sum: { $cond: [{ $eq: ['$personType', 'member'] }, 1, 0] },
          },
        },
      },
    ]);
    return result;
  }

  async update(id: string, dto: UpdateAttendanceDto, currentUser: AuthUser) {
    const existing = await this.attendanceModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }

    const currentBranchId = String(existing.branchId);
    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId ?? currentBranchId,
    );
    const entryMode = dto.entryMode ?? existing.entryMode;
    const personType = dto.personType ?? existing.personType;
    const existingGuestId = existing.guestId ? String(existing.guestId) : undefined;
    const existingMemberId = existing.memberId ? String(existing.memberId) : undefined;
    const guestId = personType === 'guest' ? (dto.guestId ?? existingGuestId) : undefined;
    const memberId = personType === 'member' ? (dto.memberId ?? existingMemberId) : undefined;
    const existingServiceTypeId = existing.serviceTypeId
      ? String(existing.serviceTypeId)
      : undefined;
    const existingServiceScheduleId = existing.serviceScheduleId
      ? String(existing.serviceScheduleId)
      : undefined;
    const existingServiceInstanceId = existing.serviceInstanceId
      ? String(existing.serviceInstanceId)
      : undefined;

    if (entryMode === 'individual') {
      await this.validatePersonScope(currentUser, branchId, { personType, guestId, memberId });
    } else {
      this.validateSummaryCounts({
        menCount: dto.menCount ?? existing.menCount,
        womenCount: dto.womenCount ?? existing.womenCount,
        childrenCount: dto.childrenCount ?? existing.childrenCount,
        adultsCount: dto.adultsCount ?? existing.adultsCount,
        firstTimersCount: dto.firstTimersCount ?? existing.firstTimersCount,
        newConvertsCount: dto.newConvertsCount ?? existing.newConvertsCount,
        holySpiritBaptismCount:
          dto.holySpiritBaptismCount ?? existing.holySpiritBaptismCount,
      });
    }

    const serviceDate = dto.serviceDate
      ? this.validatePastOrTodayServiceDate(dto.serviceDate)
      : existing.serviceDate;
    const shouldResolveServiceContext =
      !!dto.serviceTypeId ||
      !!dto.serviceType ||
      !!dto.serviceTypeLabel ||
      !!dto.serviceName ||
      !!dto.serviceScheduleId ||
      !!dto.serviceInstanceId ||
      !!dto.serviceDate ||
      !!existingServiceScheduleId ||
      !!existingServiceInstanceId;
    const serviceContext = shouldResolveServiceContext
      ? await this.resolveServiceContext(currentUser, branchId, {
          serviceDate:
            serviceDate instanceof Date ? serviceDate.toISOString() : serviceDate,
          serviceTypeId: dto.serviceTypeId ?? existingServiceTypeId,
          serviceType: dto.serviceType ?? existing.serviceType,
          serviceTypeLabel: dto.serviceTypeLabel ?? existing.serviceTypeLabel,
          serviceName: dto.serviceName ?? existing.serviceName,
          serviceScheduleId: dto.serviceScheduleId ?? existingServiceScheduleId,
          serviceInstanceId: dto.serviceInstanceId ?? existingServiceInstanceId,
        })
      : {
          serviceType: existing.serviceType,
          serviceTypeLabel: existing.serviceTypeLabel,
          serviceTypeId: existing.serviceTypeId,
          serviceScheduleId: existing.serviceScheduleId,
          serviceInstanceId: existing.serviceInstanceId,
          serviceName: existing.serviceName,
        };

    const record = await this.attendanceModel
      .findByIdAndUpdate(
        id,
        {
          branchId,
          entryMode,
          serviceDate,
          ...serviceContext,
          personType,
          guestId,
          memberId,
          menCount: dto.menCount ?? existing.menCount,
          womenCount: dto.womenCount ?? existing.womenCount,
          childrenCount: dto.childrenCount ?? existing.childrenCount,
          adultsCount: dto.adultsCount ?? existing.adultsCount,
          firstTimersCount: dto.firstTimersCount ?? existing.firstTimersCount,
          newConvertsCount: dto.newConvertsCount ?? existing.newConvertsCount,
          holySpiritBaptismCount: dto.holySpiritBaptismCount ?? existing.holySpiritBaptismCount,
        },
        { new: true },
      )
      .populate('branchId')
      .populate('serviceTypeId')
      .populate('serviceScheduleId')
      .populate('serviceInstanceId')
      .populate('guestId')
      .populate('memberId')
      .lean();

    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    if (serviceContext.serviceInstanceId) {
      await this.serviceSchedulesService.touchServiceInstance(
        String(serviceContext.serviceInstanceId),
        'attendance',
      );
    }

    await this.auditLogsService.record({
      entityType: 'attendance',
      entityId: String(record._id),
      action: 'updated',
      summary: `${entryMode === 'summary' ? 'Attendance summary' : 'Attendance record'} updated for ${
        serviceContext.serviceName || serviceContext.serviceTypeLabel || serviceContext.serviceType
      }`,
      actor: currentUser,
      branchId,
      metadata: {
        entryMode,
        serviceDate,
        personType,
        serviceType: serviceContext.serviceType,
        serviceName: serviceContext.serviceName,
      },
    });

    return record;
  }
}
