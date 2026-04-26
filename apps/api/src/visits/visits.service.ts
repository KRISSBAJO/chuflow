import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateVisitDto } from './dto/create-visit.dto';
import { Visit, VisitDocument } from './schemas/visit.schema';

@Injectable()
export class VisitsService {
  constructor(
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async resolveBranchId(currentUser?: AuthUser, branchId?: string) {
    return this.accessScopeService.resolveScopedBranchId(currentUser, branchId);
  }

  async create(dto: CreateVisitDto, currentUser?: AuthUser) {
    const branchId = await this.resolveBranchId(currentUser, dto.branchId);
    return this.visitModel.create({
      ...dto,
      branchId,
      visitDate: new Date(dto.visitDate),
    });
  }

  async findAll(currentUser: AuthUser, branchId?: string, guestId?: string) {
    const branchFilter = await this.accessScopeService.buildBranchFilter(
      currentUser,
      branchId,
    );
    const query = Object.fromEntries(
      Object.entries({
        ...branchFilter,
        ...(guestId ? { guestId } : {}),
      }).filter(([, value]) => value),
    );
    return this.visitModel.find(query).populate('guestId').sort({ visitDate: -1 }).lean();
  }

  async findOne(id: string, currentUser: AuthUser) {
    const visit = await this.visitModel.findById(id).populate('guestId').lean();
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    await this.accessScopeService.ensureBranchAccess(currentUser, String(visit.branchId));
    return visit;
  }
}
