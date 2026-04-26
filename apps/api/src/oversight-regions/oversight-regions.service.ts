import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  isGlobalRole,
} from '../common/constants/roles.constants';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { District, DistrictDocument } from '../districts/schemas/district.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreateOversightRegionDto,
  UpdateOversightRegionDto,
} from './dto/manage-oversight-region.dto';
import {
  OversightRegion,
  OversightRegionDocument,
} from './schemas/oversight-region.schema';

export type OversightRegionSummary = {
  _id: string;
  name: string;
  isActive: boolean;
  branchCount: number;
  districtCount: number;
};

@Injectable()
export class OversightRegionsService implements OnModuleInit {
  constructor(
    @InjectModel(OversightRegion.name)
    private readonly oversightRegionModel: Model<OversightRegionDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(District.name)
    private readonly districtModel: Model<DistrictDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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

  private toSummary(
    region: { _id: unknown; name: string; isActive: boolean },
    counts: {
      branchCountMap: Map<string, number>;
      districtCountMap: Map<string, number>;
    },
  ): OversightRegionSummary {
    return {
      _id: String(region._id),
      name: region.name,
      isActive: region.isActive,
      branchCount: counts.branchCountMap.get(region.name) ?? 0,
      districtCount: counts.districtCountMap.get(region.name) ?? 0,
    };
  }

  private async findAccessibleDocument(id: string, currentUser: AuthUser) {
    const region = await this.oversightRegionModel.findById(id);

    if (!region) {
      throw new NotFoundException('Oversight region not found');
    }

    if (
      !isGlobalRole(currentUser.role) &&
      this.toKey(region.name) !== this.toKey(currentUser.oversightRegion || '')
    ) {
      throw new ForbiddenException('You cannot access oversight regions outside your scope');
    }

    return region;
  }

  private async buildCounts(): Promise<{
    branchCountMap: Map<string, number>;
    districtCountMap: Map<string, number>;
  }> {
    const [branchCounts, districtCounts] = await Promise.all([
      this.branchModel.aggregate([
        {
          $match: {
            oversightRegion: { $exists: true, $nin: [null, ''] },
          },
        },
        { $group: { _id: '$oversightRegion', total: { $sum: 1 } } },
      ]),
      this.branchModel.aggregate([
        {
          $match: {
            oversightRegion: { $exists: true, $nin: [null, ''] },
            district: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$oversightRegion',
            districts: { $addToSet: '$district' },
          },
        },
      ]),
    ]);

    return {
      branchCountMap: new Map(
        branchCounts
          .map((item: { _id: unknown; total: number }) => ({
            name: this.normalizeName(item._id),
            total: item.total,
          }))
          .filter((item) => item.name)
          .map((item) => [item.name, item.total]),
      ),
      districtCountMap: new Map(
        districtCounts
          .map((item: { _id: unknown; districts: unknown[] }) => ({
            name: this.normalizeName(item._id),
            districts: item.districts
              .map((district) => this.normalizeName(district))
              .filter(Boolean),
          }))
          .filter((item) => item.name)
          .map((item) => [item.name, item.districts.length]),
      ),
    };
  }

  async onModuleInit() {
    const [branchRegions, userRegions] = await Promise.all([
      this.branchModel.distinct('oversightRegion', {
        oversightRegion: { $exists: true, $nin: [null, ''] },
      }),
      this.userModel.distinct('oversightRegion', {
        oversightRegion: { $exists: true, $nin: [null, ''] },
      }),
    ]);

    const names = [...new Set([...branchRegions, ...userRegions])]
      .map((name) => this.normalizeName(String(name)))
      .filter(Boolean);

    await Promise.all(names.map((name) => this.ensureExists(name)));
  }

  async ensureExists(name: string) {
    const normalizedName = this.normalizeName(name);
    const key = this.toKey(name);

    if (!normalizedName) {
      throw new BadRequestException('Oversight region name is required');
    }

    return this.oversightRegionModel.findOneAndUpdate(
      { normalizedName: key },
      {
        name: normalizedName,
        normalizedName: key,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async create(
    dto: CreateOversightRegionDto,
  ): Promise<OversightRegionSummary> {
    const region = await this.ensureExists(dto.name);

    if (dto.isActive !== undefined && region.isActive !== dto.isActive) {
      region.isActive = dto.isActive;
      await region.save();
    }

    const counts = await this.buildCounts();

    return this.toSummary(region, counts);
  }

  async findAll(currentUser: AuthUser): Promise<OversightRegionSummary[]> {
    if (!isGlobalRole(currentUser.role) && currentUser.oversightRegion) {
      await this.ensureExists(currentUser.oversightRegion);
    }

    const counts = await this.buildCounts();
    const query = isGlobalRole(currentUser.role)
      ? {}
      : {
          normalizedName: this.toKey(currentUser.oversightRegion || ''),
        };

    const regions = await this.oversightRegionModel.find(query).sort({ name: 1 }).lean();

    return regions.map((region) => this.toSummary(region, counts));
  }

  async findOne(
    id: string,
    currentUser: AuthUser,
  ): Promise<OversightRegionSummary> {
    const [region, counts] = await Promise.all([
      this.findAccessibleDocument(id, currentUser),
      this.buildCounts(),
    ]);

    return this.toSummary(region, counts);
  }

  async update(
    id: string,
    dto: UpdateOversightRegionDto,
    currentUser: AuthUser,
  ): Promise<OversightRegionSummary> {
    const region = await this.findAccessibleDocument(id, currentUser);
    const oldName = region.name;
    const oldKey = region.normalizedName;
    const nextName =
      dto.name !== undefined ? this.normalizeName(dto.name) : region.name;

    if (!nextName) {
      throw new BadRequestException('Oversight region name is required');
    }

    const nextKey = this.toKey(nextName);

    if (nextKey !== oldKey) {
      const existingRegion = await this.oversightRegionModel.findOne({
        normalizedName: nextKey,
        _id: { $ne: region._id },
      });

      if (existingRegion) {
        throw new BadRequestException('An oversight region with that name already exists');
      }
    }

    region.name = nextName;
    region.normalizedName = nextKey;

    if (dto.isActive !== undefined) {
      region.isActive = dto.isActive;
    }

    await region.save();

    if (oldKey !== nextKey) {
      const districts = await this.districtModel
        .find({ oversightRegionNormalized: oldKey })
        .select('_id name')
        .lean();

      if (districts.length > 0) {
        await this.districtModel.bulkWrite(
          districts.map((district) => ({
            updateOne: {
              filter: { _id: district._id },
              update: {
                $set: {
                  oversightRegion: nextName,
                  oversightRegionNormalized: nextKey,
                  key: `${nextKey}::${this.toKey(district.name)}`,
                },
              },
            },
          })),
        );
      }

      await Promise.all([
        this.branchModel.updateMany(
          { oversightRegion: oldName },
          { $set: { oversightRegion: nextName } },
        ),
        this.userModel.updateMany(
          { oversightRegion: oldName },
          { $set: { oversightRegion: nextName } },
        ),
      ]);
    }

    const counts = await this.buildCounts();

    return this.toSummary(region, counts);
  }
}
