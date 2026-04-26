import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { CreateServiceUnitDto, UpdateServiceUnitDto } from './dto/create-service-unit.dto';
import { ServiceUnit, ServiceUnitDocument } from './schemas/service-unit.schema';

@Injectable()
export class ServiceUnitsService {
  constructor(
    @InjectModel(ServiceUnit.name) private readonly serviceUnitModel: Model<ServiceUnitDocument>,
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async ensureUniqueName(name: string, branchId?: string, currentId?: string) {
    if (!branchId) {
      return;
    }

    const existing = await this.serviceUnitModel.findOne({
      branchId,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
      name: { $regex: new RegExp(`^${this.escapeRegExp(name.trim())}$`, 'i') },
    });

    if (existing) {
      throw new BadRequestException('A service unit with this name already exists in the branch');
    }
  }

  private async ensureMemberOwnership(memberId: string, branchId: string, label: string) {
    const member = await this.memberModel.findById(memberId).lean();

    if (!member) {
      throw new BadRequestException(`${label} member was not found`);
    }

    if (String(member.branchId) !== branchId) {
      throw new BadRequestException(`${label} must belong to the same branch as the service unit`);
    }
  }

  private async buildResponse(unitId: string, currentUser: AuthUser): Promise<Record<string, unknown>> {
    const unit = await this.serviceUnitModel
      .findById(unitId)
      .populate('branchId')
      .populate('leaderMemberId')
      .populate('secretaryMemberId')
      .lean();

    if (!unit) {
      throw new NotFoundException('Service unit not found');
    }

    await this.accessScopeService.ensureBranchAccess(
      currentUser,
      typeof unit.branchId === 'object' && unit.branchId !== null && '_id' in unit.branchId
        ? String((unit.branchId as { _id?: unknown })._id ?? '')
        : String(unit.branchId ?? ''),
    );

    const memberCount = await this.memberModel.countDocuments({ serviceUnitId: unit._id });

    return {
      ...unit,
      memberCount,
    };
  }

  async create(
    dto: CreateServiceUnitDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const branchId = await this.accessScopeService.resolveScopedBranchId(currentUser, dto.branchId);

    if (!branchId) {
      throw new BadRequestException('A branch is required to create a service unit');
    }

    await this.ensureUniqueName(dto.name, branchId);

    if (dto.leaderMemberId) {
      await this.ensureMemberOwnership(dto.leaderMemberId, branchId, 'Leader');
    }

    if (dto.secretaryMemberId) {
      await this.ensureMemberOwnership(dto.secretaryMemberId, branchId, 'Secretary');
    }

    if (dto.leaderMemberId && dto.secretaryMemberId && dto.leaderMemberId === dto.secretaryMemberId) {
      throw new BadRequestException('Leader and secretary should not be the same member');
    }

    const unit = await this.serviceUnitModel.create({
      ...dto,
      branchId,
      name: dto.name.trim(),
      meetingDay: dto.meetingDay.trim(),
      prayerDay: dto.prayerDay.trim(),
      notes: dto.notes?.trim(),
      isActive: dto.isActive ?? true,
    });

    return this.buildResponse(unit.id, currentUser);
  }

  async findAll(
    currentUser: AuthUser,
    branchId?: string,
  ): Promise<Record<string, unknown>[]> {
    const units = await this.serviceUnitModel
      .find(await this.accessScopeService.buildBranchFilter(currentUser, branchId))
      .populate('branchId')
      .populate('leaderMemberId')
      .populate('secretaryMemberId')
      .sort({ createdAt: -1 })
      .lean();

    const counts = await this.memberModel.aggregate([
      {
        $match: {
          serviceUnitId: { $in: units.map((unit) => unit._id) },
        },
      },
      {
        $group: {
          _id: '$serviceUnitId',
          total: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(counts.map((item) => [String(item._id), item.total]));

    return units.map((unit) => ({
      ...unit,
      memberCount: countMap.get(String(unit._id)) ?? 0,
    }));
  }

  async findOne(id: string, currentUser: AuthUser): Promise<Record<string, unknown>> {
    return this.buildResponse(id, currentUser);
  }

  async update(
    id: string,
    dto: UpdateServiceUnitDto,
    currentUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.serviceUnitModel.findById(id).lean();

    if (!existing) {
      throw new NotFoundException('Service unit not found');
    }

    await this.accessScopeService.ensureBranchAccess(currentUser, String(existing.branchId));

    const branchId = await this.accessScopeService.resolveScopedBranchId(
      currentUser,
      dto.branchId ?? String(existing.branchId),
    );

    if (!branchId) {
      throw new BadRequestException('A branch is required to update a service unit');
    }

    await this.ensureUniqueName(dto.name ?? existing.name, branchId, id);

    const leaderMemberId =
      dto.leaderMemberId ?? (existing.leaderMemberId ? String(existing.leaderMemberId) : undefined);
    const secretaryMemberId =
      dto.secretaryMemberId ?? (existing.secretaryMemberId ? String(existing.secretaryMemberId) : undefined);

    if (leaderMemberId) {
      await this.ensureMemberOwnership(leaderMemberId, branchId, 'Leader');
    }

    if (secretaryMemberId) {
      await this.ensureMemberOwnership(secretaryMemberId, branchId, 'Secretary');
    }

    if (leaderMemberId && secretaryMemberId && leaderMemberId === secretaryMemberId) {
      throw new BadRequestException('Leader and secretary should not be the same member');
    }

    await this.serviceUnitModel.findByIdAndUpdate(id, {
      ...dto,
      branchId,
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.meetingDay !== undefined ? { meetingDay: dto.meetingDay.trim() } : {}),
      ...(dto.prayerDay !== undefined ? { prayerDay: dto.prayerDay.trim() } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || undefined } : {}),
    });

    return this.buildResponse(id, currentUser);
  }

  async findNamesByBranch(branchId: string) {
    const units = await this.serviceUnitModel
      .find({ branchId, isActive: true })
      .sort({ name: 1 })
      .lean();

    return units.map((unit) => unit.name);
  }

  async findByNameWithinBranch(branchId: string, name: string) {
    return this.serviceUnitModel.findOne({
      branchId,
      name: { $regex: new RegExp(`^${this.escapeRegExp(name.trim())}$`, 'i') },
    });
  }
}
