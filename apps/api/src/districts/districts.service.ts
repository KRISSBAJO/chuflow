import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  isDistrictRole,
  isGlobalRole,
  isNationalRole,
} from '../common/constants/roles.constants';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OversightRegionsService } from '../oversight-regions/oversight-regions.service';
import { CreateDistrictDto, UpdateDistrictDto } from './dto/manage-district.dto';
import { District, DistrictDocument } from './schemas/district.schema';

export type DistrictSummary = {
  _id: string;
  name: string;
  oversightRegion: string;
  isActive: boolean;
  branchCount: number;
};

@Injectable()
export class DistrictsService implements OnModuleInit {
  constructor(
    @InjectModel(District.name)
    private readonly districtModel: Model<DistrictDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly oversightRegionsService: OversightRegionsService,
  ) {}

  private normalizeName(value: unknown) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private toKey(value: string) {
    return this.normalizeName(value).toLowerCase();
  }

  private buildKey(oversightRegion: string, district: string) {
    return `${this.toKey(oversightRegion)}::${this.toKey(district)}`;
  }

  private toSummary(
    district: {
      _id: unknown;
      name: string;
      oversightRegion: string;
      isActive: boolean;
      key: string;
    },
    branchCounts: Map<string, number>,
  ): DistrictSummary {
    return {
      _id: String(district._id),
      name: district.name,
      oversightRegion: district.oversightRegion,
      isActive: district.isActive,
      branchCount: branchCounts.get(district.key) ?? 0,
    };
  }

  private async findAccessibleDocument(id: string, currentUser: AuthUser) {
    const district = await this.districtModel.findById(id);

    if (!district) {
      throw new NotFoundException('District not found');
    }

    if (isGlobalRole(currentUser.role)) {
      return district;
    }

    const scopedRegion = this.normalizeName(currentUser.oversightRegion || '');
    const scopedDistrict = this.normalizeName(currentUser.district || '');

    if (isNationalRole(currentUser.role)) {
      if (district.oversightRegion !== scopedRegion) {
        throw new ForbiddenException('You cannot access districts outside your oversight region');
      }

      return district;
    }

    if (
      district.oversightRegion !== scopedRegion ||
      district.name !== scopedDistrict
    ) {
      throw new ForbiddenException('You cannot access districts outside your scope');
    }

    return district;
  }

  private async buildCounts(): Promise<Map<string, number>> {
    const counts = await this.branchModel.aggregate([
      {
        $match: {
          oversightRegion: { $exists: true, $nin: [null, ''] },
          district: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: {
            oversightRegion: '$oversightRegion',
            district: '$district',
          },
          total: { $sum: 1 },
        },
      },
    ]);

    return new Map(
      counts
        .map((item: {
          _id: { oversightRegion: unknown; district: unknown };
          total: number;
        }) => ({
          oversightRegion: this.normalizeName(item._id.oversightRegion),
          district: this.normalizeName(item._id.district),
          total: item.total,
        }))
        .filter((item) => item.oversightRegion && item.district)
        .map((item) => [
          this.buildKey(item.oversightRegion, item.district),
          item.total,
        ]),
    );
  }

  async onModuleInit() {
    const [branchDistricts, userDistricts] = await Promise.all([
      this.branchModel.aggregate([
        {
          $match: {
            oversightRegion: { $exists: true, $nin: [null, ''] },
            district: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: {
              oversightRegion: '$oversightRegion',
              district: '$district',
            },
          },
        },
      ]),
      this.userModel.aggregate([
        {
          $match: {
            oversightRegion: { $exists: true, $nin: [null, ''] },
            district: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: {
              oversightRegion: '$oversightRegion',
              district: '$district',
            },
          },
        },
      ]),
    ]);

    const definitions = [...branchDistricts, ...userDistricts].map(
      (item: { _id: { oversightRegion: string; district: string } }) => ({
        oversightRegion: this.normalizeName(item._id.oversightRegion),
        district: this.normalizeName(item._id.district),
      }),
    );

    const seen = new Set<string>();

    await Promise.all(
      definitions
        .filter((item) => {
          const key = this.buildKey(item.oversightRegion, item.district);

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        })
        .map((item) => this.ensureExists(item.oversightRegion, item.district)),
    );
  }

  async ensureExists(oversightRegion: string, district: string) {
    const normalizedRegion = this.normalizeName(oversightRegion);
    const normalizedDistrict = this.normalizeName(district);

    if (!normalizedRegion) {
      throw new BadRequestException('Oversight region is required');
    }

    if (!normalizedDistrict) {
      throw new BadRequestException('District name is required');
    }

    await this.oversightRegionsService.ensureExists(normalizedRegion);

    return this.districtModel.findOneAndUpdate(
      { key: this.buildKey(normalizedRegion, normalizedDistrict) },
      {
        name: normalizedDistrict,
        normalizedName: this.toKey(normalizedDistrict),
        oversightRegion: normalizedRegion,
        oversightRegionNormalized: this.toKey(normalizedRegion),
        key: this.buildKey(normalizedRegion, normalizedDistrict),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async create(
    dto: CreateDistrictDto,
    currentUser: AuthUser,
  ): Promise<DistrictSummary> {
    const oversightRegion = isGlobalRole(currentUser.role)
      ? this.normalizeName(dto.oversightRegion || '')
      : this.normalizeName(currentUser.oversightRegion || '');

    if (!oversightRegion) {
      throw new BadRequestException('An oversight region is required to create a district');
    }

    const district = await this.ensureExists(oversightRegion, dto.name);

    if (dto.isActive !== undefined && district.isActive !== dto.isActive) {
      district.isActive = dto.isActive;
      await district.save();
    }

    const branchCounts = await this.buildCounts();

    return this.toSummary(district, branchCounts);
  }

  async findAll(
    currentUser: AuthUser,
    oversightRegion?: string,
  ): Promise<DistrictSummary[]> {
    const requestedRegion = this.normalizeName(oversightRegion || '');
    let query: Record<string, unknown> = {};

    if (isGlobalRole(currentUser.role)) {
      if (requestedRegion) {
        query.oversightRegionNormalized = this.toKey(requestedRegion);
      }
    } else if (isNationalRole(currentUser.role)) {
      const scopedRegion = this.normalizeName(currentUser.oversightRegion || '');
      await this.oversightRegionsService.ensureExists(scopedRegion);
      query.oversightRegionNormalized = this.toKey(scopedRegion);
    } else if (isDistrictRole(currentUser.role) || currentUser.district) {
      const scopedRegion = this.normalizeName(currentUser.oversightRegion || '');
      const scopedDistrict = this.normalizeName(currentUser.district || '');

      if (scopedRegion && scopedDistrict) {
        await this.ensureExists(scopedRegion, scopedDistrict);
      }

      query.key = this.buildKey(scopedRegion, scopedDistrict);
    } else if (currentUser.oversightRegion) {
      query.oversightRegionNormalized = this.toKey(currentUser.oversightRegion);
    }

    const [districts, branchCounts] = await Promise.all([
      this.districtModel
        .find(query)
        .sort({ oversightRegion: 1, name: 1 })
        .lean(),
      this.buildCounts(),
    ]);

    return districts.map((district) => this.toSummary(district, branchCounts));
  }

  async findOne(id: string, currentUser: AuthUser): Promise<DistrictSummary> {
    const [district, branchCounts] = await Promise.all([
      this.findAccessibleDocument(id, currentUser),
      this.buildCounts(),
    ]);

    return this.toSummary(district, branchCounts);
  }

  async update(
    id: string,
    dto: UpdateDistrictDto,
    currentUser: AuthUser,
  ): Promise<DistrictSummary> {
    const district = await this.findAccessibleDocument(id, currentUser);
    const oldRegion = district.oversightRegion;
    const oldName = district.name;
    const scopedRegion = this.normalizeName(currentUser.oversightRegion || '');
    const requestedRegion = this.normalizeName(dto.oversightRegion || '');

    if (
      !isGlobalRole(currentUser.role) &&
      requestedRegion &&
      requestedRegion !== scopedRegion
    ) {
      throw new ForbiddenException('You cannot move a district outside your oversight region');
    }

    const nextRegion = isGlobalRole(currentUser.role)
      ? this.normalizeName(dto.oversightRegion || district.oversightRegion)
      : scopedRegion;
    const nextName =
      dto.name !== undefined ? this.normalizeName(dto.name) : district.name;

    if (!nextRegion) {
      throw new BadRequestException('An oversight region is required for this district');
    }

    if (!nextName) {
      throw new BadRequestException('District name is required');
    }

    const nextKey = this.buildKey(nextRegion, nextName);

    if (nextKey !== district.key) {
      const existingDistrict = await this.districtModel.findOne({
        key: nextKey,
        _id: { $ne: district._id },
      });

      if (existingDistrict) {
        throw new BadRequestException('A district with that name already exists in the selected national area');
      }
    }

    await this.oversightRegionsService.ensureExists(nextRegion);

    district.name = nextName;
    district.normalizedName = this.toKey(nextName);
    district.oversightRegion = nextRegion;
    district.oversightRegionNormalized = this.toKey(nextRegion);
    district.key = nextKey;

    if (dto.isActive !== undefined) {
      district.isActive = dto.isActive;
    }

    await district.save();

    if (oldRegion !== nextRegion || oldName !== nextName) {
      await Promise.all([
        this.branchModel.updateMany(
          { oversightRegion: oldRegion, district: oldName },
          {
            $set: {
              oversightRegion: nextRegion,
              district: nextName,
            },
          },
        ),
        this.userModel.updateMany(
          { oversightRegion: oldRegion, district: oldName },
          {
            $set: {
              oversightRegion: nextRegion,
              district: nextName,
            },
          },
        ),
      ]);
    }

    const branchCounts = await this.buildCounts();

    return this.toSummary(district, branchCounts);
  }
}
