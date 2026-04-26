import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ServiceType, ServiceTypeDocument } from './schemas/service-type.schema';
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto/create-service-type.dto';

@Injectable()
export class ServiceTypesService {
  constructor(
    @InjectModel(ServiceType.name) private readonly serviceTypeModel: Model<ServiceTypeDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async ensureUniqueWithinBranch(
    branchId: string,
    name: string,
    key: string,
    currentId?: string,
  ) {
    const existing = await this.serviceTypeModel.findOne({
      branchId,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
      $or: [
        { name: { $regex: new RegExp(`^${this.escapeRegExp(name)}$`, 'i') } },
        { key: { $regex: new RegExp(`^${this.escapeRegExp(key)}$`, 'i') } },
      ],
    });

    if (existing) {
      throw new BadRequestException('A service type with this name or key already exists in the branch');
    }
  }

  private async buildResponse(
    serviceTypeId: string,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const serviceType = await this.serviceTypeModel.findById(serviceTypeId).populate('branchId').lean();

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    const branchId =
      typeof serviceType.branchId === 'object' &&
      serviceType.branchId !== null &&
      '_id' in serviceType.branchId
        ? String((serviceType.branchId as { _id?: unknown })._id)
        : String(serviceType.branchId);

    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    return serviceType as unknown as Record<string, unknown>;
  }

  async create(
    dto: CreateServiceTypeDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);

    if (!branchId) {
      throw new BadRequestException('A branch is required to create a service type');
    }

    const name = dto.name.trim();
    const key = this.slugify(dto.key || dto.name);

    await this.ensureUniqueWithinBranch(branchId, name, key);

    const serviceType = await this.serviceTypeModel.create({
      branchId,
      name,
      key,
      isActive: dto.isActive ?? true,
      notes: dto.notes?.trim() || undefined,
    });

    return this.buildResponse(serviceType.id, currentUser);
  }

  async findAll(
    currentUser: AuthUser,
    branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    const serviceTypes = await this.serviceTypeModel
      .find(await this.accessScopeService.buildBranchFilter(currentUser, branchId))
      .populate('branchId')
      .sort({ name: 1 })
      .lean();

    return serviceTypes as unknown as Record<string, unknown>[];
  }

  async findOne(
    id: string,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.buildResponse(id, currentUser);
  }

  async update(
    id: string,
    dto: UpdateServiceTypeDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.serviceTypeModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Service type not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId ?? String(existing.branchId),
    );

    if (!branchId) {
      throw new BadRequestException('A branch is required to update a service type');
    }

    const name = dto.name?.trim() || existing.name;
    const key = this.slugify(dto.key || dto.name || existing.key);

    await this.ensureUniqueWithinBranch(branchId, name, key, id);

    await this.serviceTypeModel.findByIdAndUpdate(id, {
      branchId,
      ...(dto.name !== undefined ? { name } : {}),
      ...(dto.key !== undefined || dto.name !== undefined ? { key } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || undefined } : {}),
    });

    return this.buildResponse(id, currentUser);
  }

  async findActiveByBranch(branchId: string) {
    return this.serviceTypeModel.find({ branchId, isActive: true }).sort({ name: 1 }).lean();
  }

  async findNamesByBranch(branchId: string) {
    const serviceTypes = await this.findActiveByBranch(branchId);
    return serviceTypes.map((serviceType) => serviceType.name);
  }

  async findByKeyOrNameWithinBranch(branchId: string, value: string) {
    const trimmedValue = value.trim();

    return this.serviceTypeModel.findOne({
      branchId,
      $or: [
        { key: { $regex: new RegExp(`^${this.escapeRegExp(this.slugify(trimmedValue))}$`, 'i') } },
        { name: { $regex: new RegExp(`^${this.escapeRegExp(trimmedValue)}$`, 'i') } },
      ],
    });
  }
}
