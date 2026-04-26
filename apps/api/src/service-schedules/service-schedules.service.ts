import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { ServiceType, ServiceTypeDocument } from '../service-types/schemas/service-type.schema';
import { CreateServiceScheduleDto, UpdateServiceScheduleDto } from './dto/create-service-schedule.dto';
import { ServiceInstance, ServiceInstanceDocument } from './schemas/service-instance.schema';
import { ServiceSchedule, ServiceScheduleDocument } from './schemas/service-schedule.schema';

type BranchShape = Branch & { _id: Types.ObjectId };
type ServiceTypeShape = ServiceType & { _id: Types.ObjectId };

@Injectable()
export class ServiceSchedulesService {
  constructor(
    @InjectModel(ServiceSchedule.name)
    private readonly serviceScheduleModel: Model<ServiceScheduleDocument>,
    @InjectModel(ServiceInstance.name)
    private readonly serviceInstanceModel: Model<ServiceInstanceDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(ServiceType.name)
    private readonly serviceTypeModel: Model<ServiceTypeDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private readonly dayAliases = new Map<string, string>([
    ['sun', 'sunday'],
    ['sunday', 'sunday'],
    ['mon', 'monday'],
    ['monday', 'monday'],
    ['tue', 'tuesday'],
    ['tues', 'tuesday'],
    ['tuesday', 'tuesday'],
    ['wed', 'wednesday'],
    ['wednesday', 'wednesday'],
    ['thu', 'thursday'],
    ['thur', 'thursday'],
    ['thurs', 'thursday'],
    ['thursday', 'thursday'],
    ['fri', 'friday'],
    ['friday', 'friday'],
    ['sat', 'saturday'],
    ['saturday', 'saturday'],
  ]);

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException('Service schedule name is required');
    }

    return normalized;
  }

  private normalizeTime(value: string, label: string) {
    const normalized = value.trim();

    if (!/^\d{2}:\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${label} must use HH:MM format`);
    }

    const [hours, minutes] = normalized.split(':').map(Number);

    if (hours > 23 || minutes > 59) {
      throw new BadRequestException(`${label} must be a valid time`);
    }

    return normalized;
  }

  private normalizeDayOfWeek(value: string) {
    const normalized = this.dayAliases.get(value.trim().toLowerCase());

    if (!normalized) {
      throw new BadRequestException('Day of week must be a valid weekday');
    }

    return normalized;
  }

  private formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private validateServiceDate(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Service date must be a valid date');
    }

    return date;
  }

  private async resolveBranch(currentUser: AuthUser, requestedBranchId?: string) {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, requestedBranchId);

    if (!branchId) {
      throw new BadRequestException('A branch is required');
    }

    const branch = await this.branchModel
      .findById(branchId)
      .select('name oversightRegion district')
      .lean();

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch as BranchShape;
  }

  private async resolveServiceType(branchId: string, serviceTypeId: string) {
    const serviceType = await this.serviceTypeModel.findById(serviceTypeId).lean();

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    if (String(serviceType.branchId) !== String(branchId)) {
      throw new ForbiddenException('Service type must belong to the same branch');
    }

    return serviceType as ServiceTypeShape;
  }

  private async ensureUniqueSchedule(
    branchId: string,
    name: string,
    dayOfWeek: string,
    startTime: string,
    currentId?: string,
  ) {
    const existing = await this.serviceScheduleModel.findOne({
      branchId,
      dayOfWeek,
      startTime,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      isActive: true,
    });

    if (existing) {
      throw new BadRequestException('This branch already has an active schedule with the same name, day, and time');
    }
  }

  private async buildScheduleResponse(
    id: string,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const schedule = await this.serviceScheduleModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .lean();

    if (!schedule) {
      throw new NotFoundException('Service schedule not found');
    }

    const branchId =
      typeof schedule.branchId === 'object' && schedule.branchId !== null && '_id' in schedule.branchId
        ? String((schedule.branchId as { _id?: unknown })._id ?? '')
        : String(schedule.branchId ?? '');

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    return {
      ...schedule,
      _id: String(schedule._id),
      branchId:
        typeof schedule.branchId === 'object' && schedule.branchId !== null
          ? {
              _id: String((schedule.branchId as { _id?: unknown })._id ?? ''),
              name: (schedule.branchId as { name?: string }).name,
              oversightRegion: (schedule.branchId as { oversightRegion?: string }).oversightRegion,
              district: (schedule.branchId as { district?: string }).district,
            }
          : schedule.branchId,
      serviceTypeId:
        typeof schedule.serviceTypeId === 'object' && schedule.serviceTypeId !== null
          ? {
              _id: String((schedule.serviceTypeId as { _id?: unknown })._id ?? ''),
              name: (schedule.serviceTypeId as { name?: string }).name,
              key: (schedule.serviceTypeId as { key?: string }).key,
            }
          : schedule.serviceTypeId,
    };
  }

  private async buildInstanceResponse(
    id: string,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const instance = await this.serviceInstanceModel
      .findById(id)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .populate('serviceScheduleId', 'name dayOfWeek startTime timezone')
      .lean();

    if (!instance) {
      throw new NotFoundException('Service instance not found');
    }

    const branchId =
      typeof instance.branchId === 'object' && instance.branchId !== null && '_id' in instance.branchId
        ? String((instance.branchId as { _id?: unknown })._id ?? '')
        : String(instance.branchId ?? '');

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    return {
      ...instance,
      _id: String(instance._id),
      branchId:
        typeof instance.branchId === 'object' && instance.branchId !== null
          ? {
              _id: String((instance.branchId as { _id?: unknown })._id ?? ''),
              name: (instance.branchId as { name?: string }).name,
              oversightRegion: (instance.branchId as { oversightRegion?: string }).oversightRegion,
              district: (instance.branchId as { district?: string }).district,
            }
          : instance.branchId,
      serviceTypeId:
        typeof instance.serviceTypeId === 'object' && instance.serviceTypeId !== null
          ? {
              _id: String((instance.serviceTypeId as { _id?: unknown })._id ?? ''),
              name: (instance.serviceTypeId as { name?: string }).name,
              key: (instance.serviceTypeId as { key?: string }).key,
            }
          : instance.serviceTypeId,
      serviceScheduleId:
        typeof instance.serviceScheduleId === 'object' && instance.serviceScheduleId !== null
          ? {
              _id: String((instance.serviceScheduleId as { _id?: unknown })._id ?? ''),
              name: (instance.serviceScheduleId as { name?: string }).name,
              dayOfWeek: (instance.serviceScheduleId as { dayOfWeek?: string }).dayOfWeek,
              startTime: (instance.serviceScheduleId as { startTime?: string }).startTime,
              timezone: (instance.serviceScheduleId as { timezone?: string }).timezone,
            }
          : instance.serviceScheduleId,
    };
  }

  async create(
    dto: CreateServiceScheduleDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const branch = await this.resolveBranch(currentUser, dto.branchId);
    const serviceType = await this.resolveServiceType(String(branch._id), dto.serviceTypeId);
    const name = this.normalizeName(dto.name);
    const dayOfWeek = this.normalizeDayOfWeek(dto.dayOfWeek);
    const startTime = this.normalizeTime(dto.startTime, 'Start time');
    const endTime = dto.endTime ? this.normalizeTime(dto.endTime, 'End time') : undefined;

    await this.ensureUniqueSchedule(String(branch._id), name, dayOfWeek, startTime);

    const schedule = await this.serviceScheduleModel.create({
      branchId: branch._id,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      serviceTypeId: serviceType._id,
      serviceTypeKey: serviceType.key,
      serviceTypeLabel: serviceType.name,
      name,
      dayOfWeek,
      startTime,
      endTime,
      timezone: dto.timezone?.trim() || 'America/Chicago',
      locationNotes: dto.locationNotes?.trim() || undefined,
      attendanceEntryEnabled: dto.attendanceEntryEnabled ?? true,
      financeEntryEnabled: dto.financeEntryEnabled ?? true,
      isActive: dto.isActive ?? true,
    });

    await this.auditLogsService.record({
      entityType: 'service_schedule',
      entityId: String(schedule._id),
      action: 'created',
      summary: `Service schedule ${name} created for ${branch.name}`,
      actor: currentUser,
      branchId: String(branch._id),
      metadata: {
        serviceType: serviceType.name,
        dayOfWeek,
        startTime,
      },
    });

    return this.buildScheduleResponse(String(schedule._id), currentUser);
  }

  async findAll(
    currentUser: AuthUser,
    branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    const query = await this.accessScopeService.buildBranchFilter(currentUser, branchId);

    const schedules = await this.serviceScheduleModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .sort({ dayOfWeek: 1, startTime: 1, name: 1 })
      .lean();

    return Promise.all(
      schedules.map((schedule) => this.buildScheduleResponse(String(schedule._id), currentUser)),
    );
  }

  async update(
    id: string,
    dto: UpdateServiceScheduleDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.serviceScheduleModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Service schedule not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    const branch = await this.resolveBranch(
      currentUser,
      dto.branchId ?? String(existing.branchId),
    );
    const serviceType = await this.resolveServiceType(
      String(branch._id),
      dto.serviceTypeId ?? String(existing.serviceTypeId),
    );
    const name = dto.name ? this.normalizeName(dto.name) : existing.name;
    const dayOfWeek = dto.dayOfWeek
      ? this.normalizeDayOfWeek(dto.dayOfWeek)
      : existing.dayOfWeek;
    const startTime = dto.startTime
      ? this.normalizeTime(dto.startTime, 'Start time')
      : existing.startTime;
    const endTime =
      dto.endTime !== undefined
        ? dto.endTime
          ? this.normalizeTime(dto.endTime, 'End time')
          : undefined
        : existing.endTime;

    await this.ensureUniqueSchedule(String(branch._id), name, dayOfWeek, startTime, id);

    await this.serviceScheduleModel.findByIdAndUpdate(id, {
      branchId: branch._id,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      serviceTypeId: serviceType._id,
      serviceTypeKey: serviceType.key,
      serviceTypeLabel: serviceType.name,
      name,
      dayOfWeek,
      startTime,
      endTime,
      timezone: dto.timezone?.trim() || existing.timezone || 'America/Chicago',
      locationNotes:
        dto.locationNotes !== undefined ? dto.locationNotes?.trim() || undefined : existing.locationNotes,
      attendanceEntryEnabled:
        dto.attendanceEntryEnabled ?? existing.attendanceEntryEnabled ?? true,
      financeEntryEnabled: dto.financeEntryEnabled ?? existing.financeEntryEnabled ?? true,
      isActive: dto.isActive ?? existing.isActive ?? true,
    });

    await this.auditLogsService.record({
      entityType: 'service_schedule',
      entityId: id,
      action: 'updated',
      summary: `Service schedule ${name} updated`,
      actor: currentUser,
      branchId: String(branch._id),
      metadata: {
        serviceType: serviceType.name,
        dayOfWeek,
        startTime,
      },
    });

    return this.buildScheduleResponse(id, currentUser);
  }

  async resolveServiceInstanceForEntry(params: {
    currentUser: AuthUser;
    branchId: string;
    serviceDate: string | Date;
    serviceScheduleId?: string;
    serviceInstanceId?: string;
  }) {
    if (params.serviceInstanceId) {
      const existingInstance = await this.serviceInstanceModel.findById(params.serviceInstanceId).lean();

      if (!existingInstance) {
        throw new NotFoundException('Service instance not found');
      }

      await this.accessScopeService.ensureBranchAccess(params.currentUser, String(existingInstance.branchId));

      return existingInstance;
    }

    if (!params.serviceScheduleId) {
      return null;
    }

    const schedule = await this.serviceScheduleModel.findById(params.serviceScheduleId).lean();

    if (!schedule) {
      throw new NotFoundException('Service schedule not found');
    }

    if (String(schedule.branchId) !== String(params.branchId)) {
      throw new ForbiddenException('Service schedule must belong to the same branch');
    }

    await this.accessScopeService.ensureBranchAccess(params.currentUser, String(schedule.branchId));

    const serviceDate = this.validateServiceDate(params.serviceDate);
    const serviceDateKey = this.formatDateKey(serviceDate);

    const existingInstance = await this.serviceInstanceModel.findOne({
      branchId: schedule.branchId,
      serviceScheduleId: schedule._id,
      serviceDateKey,
    }).lean();

    if (existingInstance) {
      return existingInstance;
    }

    const created = await this.serviceInstanceModel.create({
      branchId: schedule.branchId,
      oversightRegion: schedule.oversightRegion,
      district: schedule.district,
      serviceScheduleId: schedule._id,
      serviceScheduleName: schedule.name,
      serviceTypeId: schedule.serviceTypeId,
      serviceTypeKey: schedule.serviceTypeKey,
      serviceTypeLabel: schedule.serviceTypeLabel,
      serviceDate,
      serviceDateKey,
      startTime: schedule.startTime,
      timezone: schedule.timezone || 'America/Chicago',
      status: 'open',
      attendanceSummaryCount: 0,
      financeEntryCount: 0,
      lastActivityAt: new Date(),
    });

    return created.toObject();
  }

  async touchServiceInstance(instanceId: string, kind: 'attendance' | 'finance') {
    if (!instanceId) {
      return;
    }

    await this.serviceInstanceModel.findByIdAndUpdate(instanceId, {
      $inc:
        kind === 'attendance'
          ? { attendanceSummaryCount: 1 }
          : { financeEntryCount: 1 },
      $set: { lastActivityAt: new Date() },
    });
  }

  async listInstances(
    currentUser: AuthUser,
    filters: {
      branchId?: string;
      serviceScheduleId?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: string;
    } = {},
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = await this.accessScopeService.buildBranchFilter(
      currentUser,
      filters.branchId,
    );

    if (filters.serviceScheduleId) {
      query.serviceScheduleId = new Types.ObjectId(filters.serviceScheduleId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.date || filters.dateFrom || filters.dateTo) {
      const dateQuery: Record<string, Date> = {};

      if (filters.date) {
        const exactDate = this.validateServiceDate(filters.date);
        dateQuery.$gte = new Date(exactDate);
        dateQuery.$lte = new Date(exactDate);
      } else {
        if (filters.dateFrom) {
          dateQuery.$gte = this.validateServiceDate(filters.dateFrom);
        }

        if (filters.dateTo) {
          dateQuery.$lte = this.validateServiceDate(filters.dateTo);
        }
      }

      query.serviceDate = dateQuery;
    }

    const instances = await this.serviceInstanceModel
      .find(query)
      .populate('branchId', 'name oversightRegion district')
      .populate('serviceTypeId', 'name key')
      .populate('serviceScheduleId', 'name dayOfWeek startTime timezone')
      .sort({ serviceDate: -1, startTime: 1 })
      .lean();

    return Promise.all(
      instances.map((instance) => this.buildInstanceResponse(String(instance._id), currentUser)),
    );
  }
}
