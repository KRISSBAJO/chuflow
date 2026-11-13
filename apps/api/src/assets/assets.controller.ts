import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Branch } from '../branches/schemas/branch.schema';
import { AssetImportRow, AssetReservationKeyDto, CreateAssetKitDto, ImportAssetsDto, MoveAssetDto, MoveAssetKitDto, RegisterAssetDto, ReserveAssetDto, ScanAssetStocktakeDto, StartAssetStocktakeDto, TransferAssetDto } from './asset.dto';
import { Asset, type AssetState } from './asset.schema';
import { AssetStocktake } from './stocktake.schema';

const priorStates: Record<AssetState, AssetState[]> = {
  available: ['checked_out', 'maintenance', 'missing'],
  checked_out: ['available'],
  maintenance: ['available', 'checked_out'],
  missing: ['available', 'checked_out'],
  retired: ['available', 'maintenance', 'missing'],
};

@Controller('assets')
@UseGuards(JwtAuthGuard)
@Roles(...LEADERSHIP_ROLES)
export class AssetsController {
  constructor(
    @InjectModel(Asset.name) private readonly assets: Model<Asset>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    private readonly access: AccessScopeService,
    @InjectModel(AssetStocktake.name) private readonly stocktakes: Model<AssetStocktake>,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string,
    @Query('before') before?: string, @Query('tag') tag?: string, @Query('assetId') assetId?: string) {
    if ([branchId, before, assetId].some(value => value !== undefined && !Types.ObjectId.isValid(value))) {
      throw new BadRequestException('Invalid inventory filter.');
    }
    const scope = await this.access.buildBranchObjectIdFilter(user, branchId);
    const rows = await this.assets.find({
      ...scope,
      ...(assetId ? { _id: new Types.ObjectId(assetId) } : before ? { _id: { $lt: new Types.ObjectId(before) } } : {}),
      ...(typeof tag === 'string' && tag.trim() ? { tag: tag.trim().toUpperCase() } : {}),
    }).select('-history').sort({ _id: -1 }).limit(51).lean();
    return {
      items: rows.slice(0, 50),
      next: rows.length > 50 ? String(rows[49]._id) : null,
      asOf: Date.now(),
    };
  }

  @Post()
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterAssetDto) {
    await this.requireBranch(user, dto.branchId);
    return this.createAsset(user, dto.branchId, dto);
  }

  @Post('import')
  async importAssets(@CurrentUser() user: AuthUser, @Body() dto: ImportAssetsDto) {
    await this.requireBranch(user, dto.branchId);
    const results: { row: number; tag: string; assetId?: string; status: 'created' | 'duplicate' }[] = [];
    for (const [index, row] of dto.rows.entries()) {
      const tag = row.tag?.trim().toUpperCase() ?? '';
      try {
        const id = dto.requestId ? new Types.ObjectId(createHash('sha256')
          .update(JSON.stringify([user.sub, dto.branchId, dto.requestId, (dto.offset ?? 0) + index, row]))
          .digest('hex').slice(0, 24)) : undefined;
        const asset = await this.createAsset(user, dto.branchId, row, id);
        results.push({ row: index + 1, tag: asset.tag, assetId: String(asset._id), status: 'created' });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        results.push({ row: index + 1, tag, status: 'duplicate' });
      }
    }
    return { results };
  }

  private async requireBranch(user: AuthUser, branchId: string) {
    await this.access.ensureBranchAccess(user, branchId);
    if (!await this.branches.exists({ _id: branchId })) throw new NotFoundException('Branch not found.');
  }

  private async createAsset(user: AuthUser, branchId: string, dto: AssetImportRow, _id = new Types.ObjectId()) {
    try {
      return await this.assets.create({
        _id, branchId, tag: dto.tag?.trim().toUpperCase() || `CF-${_id.toHexString().toUpperCase()}`, name: dto.name.trim(),
        category: dto.category.trim(), location: dto.location?.trim(), serial: dto.serial?.trim(),
        history: [{ state: 'available', at: new Date(), actorId: user.sub, actorEmail: user.email }],
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.assets.findById(_id).lean();
        if (existing) return existing;
        throw new ConflictException('That asset tag is already registered.');
      }
      throw error;
    }
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const scope = await this.assetScope(user, id);
    const row = await this.assets.findOne(scope).slice('history', -50).lean();
    if (!row) throw new NotFoundException('Asset not found.');
    return row;
  }

  @Post('kits')
  async createKit(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetKitDto) {
    await this.requireBranch(user, dto.branchId);
    const assetIds = [...new Set(dto.assetIds.map(id => id.toLowerCase()))];
    if (assetIds.length !== dto.assetIds.length) throw new BadRequestException('Select each asset only once.');
    const kitId = new Types.ObjectId();
    await this.assets.db.transaction(async (session) => {
      const result = await this.assets.updateMany({
        _id: { $in: assetIds }, branchId: dto.branchId, kitId: { $exists: false }, state: 'available',
      }, { $set: { kitId, kitName: dto.name.trim() }, $inc: { revision: 1 } }, { session });
      if (result.modifiedCount !== assetIds.length)
        throw new ConflictException('All kit items must be available, unassigned and in this branch.');
    });
    return { kitId };
  }

  @Get('stocktakes/:branchId')
  async stocktakeHistory(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string) {
    if (!Types.ObjectId.isValid(branchId)) throw new BadRequestException('Choose a branch.');
    await this.requireBranch(user, branchId);
    return this.stocktakes.find({ branchId }).select('room completedAt').sort({ _id: -1 }).limit(20).lean();
  }

  @Get('stocktakes/record/:id')
  async stocktakeDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.stocktakes.findOne(await this.assetScope(user, id)).lean();
    if (!result) throw new NotFoundException('Stocktake not found.');
    return result;
  }

  @Post('stocktakes')
  async startStocktake(@CurrentUser() user: AuthUser, @Body() dto: StartAssetStocktakeDto) {
    await this.requireBranch(user, dto.branchId);
    const room = dto.room.trim();
    const escaped = room.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expected = await this.assets.find({
      branchId: dto.branchId, location: new RegExp('^' + escaped + '$', 'i'),
      state: { $nin: ['checked_out', 'retired'] },
    }).select('tag name location').limit(2001).lean();
    if (expected.length > 2000) throw new BadRequestException('This room has too many assets for one stocktake.');
    return this.stocktakes.create({ branchId: dto.branchId, actorId: user.sub, room, expected });
  }

  @Post('stocktakes/:id/scans')
  async scanStocktake(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ScanAssetStocktakeDto) {
    const scope = await this.assetScope(user, id);
    const stocktake = await this.stocktakes.findOne(scope).lean();
    if (!stocktake) throw new NotFoundException('Stocktake not found.');
    const label = dto.label.trim();
    let assetId: string | null = null;
    if (/^https?:\/\//i.test(label)) {
      try {
        const url = new URL(label);
        if (url.pathname === '/assets') assetId = url.searchParams.get('assetId');
      } catch { throw new BadRequestException('Scan an asset label or enter its tag.'); }
      if (!assetId || !Types.ObjectId.isValid(assetId)) throw new BadRequestException('Scan an asset label or enter its tag.');
    }
    const asset = await this.assets.findOne({
      branchId: stocktake.branchId, state: { $ne: 'retired' },
      ...(assetId ? { _id: assetId } : { tag: label.toUpperCase() }),
    }).select('name tag location').lean();
    if (!asset) throw new NotFoundException('Asset not found in this branch.');
    const scan = {
      asset: { ...asset, _id: String(asset._id) },
      result: stocktake.expected.some(item => String(item._id) === String(asset._id)) ? 'present' : 'misplaced',
    };
    const updated = await this.stocktakes.findOneAndUpdate({
      ...scope, completedAt: { $exists: false }, 'scans.asset._id': { $ne: scan.asset._id },
      'scans.2999': { $exists: false },
    }, { $push: { scans: scan } }, { new: true }).lean();
    if (updated) return updated;
    const latest = await this.stocktakes.findOne(scope).lean();
    if (latest?.scans.some(entry => entry.asset._id === scan.asset._id)) return latest;
    throw new ConflictException('This stocktake is closed or has reached its scan limit.');
  }

  @Patch('stocktakes/:id/complete')
  async finishStocktake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const scope = await this.assetScope(user, id);
    const result = await this.stocktakes.findOneAndUpdate({
      ...scope, completedAt: { $exists: false },
    }, { $set: { completedAt: new Date() } }, { new: true }).lean()
      ?? await this.stocktakes.findOne(scope).lean();
    if (!result) throw new NotFoundException('Stocktake not found.');
    return result;
  }

  @Patch('kits/:id/movement')
  async moveKit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveAssetKitDto) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Kit not found.');
    await this.requireBranch(user, dto.branchId);
    const checkout = dto.state === 'checked_out';
    const holder = dto.holder?.trim();
    const activity = dto.activity?.trim();
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (checkout && (!holder || !activity || !dueAt || dueAt.getTime() <= Date.now()))
      throw new BadRequestException('Checkout needs a recipient, activity and future return time.');
    const scope = { kitId: id, branchId: dto.branchId };
    const now = new Date();
    const kitCheckoutId = new Types.ObjectId();
    return this.assets.db.transaction(async (session) => {
      const count = await this.assets.countDocuments(scope).session(session);
      if (!count) throw new NotFoundException('Kit not found.');
      const result = await this.assets.updateMany({
        ...scope,
        ...(checkout ? { state: 'available', reservations: { $not: { $elemMatch: {
          cancelledAt: { $exists: false }, endsAt: { $gt: now }, startsAt: { $lt: dueAt },
          $or: [{ holder: { $ne: holder } }, { activity: { $ne: activity } },
            { startsAt: { $gt: now } }, { endsAt: { $lt: dueAt } }],
        } } } } : { state: 'checked_out', kitCheckoutId: { $exists: true } }),
      }, {
        $set: { state: dto.state, ...(checkout ? { holder, activity, dueAt, kitCheckoutId } : {}) },
        ...(!checkout ? { $unset: { holder: 1, activity: 1, dueAt: 1, kitCheckoutId: 1 } } : {}),
        $inc: { revision: 1 },
        $push: { history: { state: dto.state, at: now, actorId: user.sub, actorEmail: user.email,
          ...(checkout ? { holder, activity, kitCheckoutId } : {}) } },
      }, { session });
      if (checkout && result.modifiedCount !== count)
        throw new ConflictException('A kit item is unavailable or reserved. No items were checked out.');
      return { moved: result.modifiedCount };
    });
  }

  @Patch(':id/movement')
  async move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveAssetDto) {
    const scope = await this.assetScope(user, id);
    const checkout = dto.state === 'checked_out';
    const holder = dto.holder?.trim();
    const activity = dto.activity?.trim();
    const note = dto.note?.trim();
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (checkout && (!holder || !activity || !dueAt || dueAt.getTime() <= Date.now())) {
      throw new BadRequestException('Checkout needs a recipient, activity and future return time.');
    }
    if (['maintenance', 'missing', 'retired'].includes(dto.state) && !note) {
      throw new BadRequestException('Add a note explaining the change.');
    }
    const now = new Date();
    const result = await this.assets.findOneAndUpdate(
      {
        ...scope, revision: dto.revision, state: { $in: priorStates[dto.state] },
        ...(checkout ? { reservations: { $not: { $elemMatch: {
          cancelledAt: { $exists: false }, endsAt: { $gt: now }, startsAt: { $lt: dueAt },
          $or: [{ holder: { $ne: holder } }, { activity: { $ne: activity } },
            { startsAt: { $gt: now } }, { endsAt: { $lt: dueAt } }],
        } } } } : {}),
      },
      {
        $set: { state: dto.state, ...(checkout ? { holder, activity, dueAt } : {}) },
        ...(!checkout ? { $unset: { holder: 1, activity: 1, dueAt: 1, kitCheckoutId: 1 } } : {}),
        $inc: { revision: 1 },
        $push: { history: { state: dto.state, at: new Date(), actorId: user.sub, actorEmail: user.email, ...(checkout ? { holder, activity } : {}), note } },
      },
      { new: true, projection: { history: { $slice: -50 } } },
    ).lean();
    if (!result) throw new ConflictException('The asset changed or this action is unavailable. Reload before trying again.');
    return result;
  }

  @Post(':id/reservations')
  async reserve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReserveAssetDto) {
    const scope = await this.assetScope(user, id);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt.getTime() < Date.now() || endsAt <= startsAt) {
      throw new BadRequestException('Choose a future start and a later end time.');
    }
    const result = await this.assets.findOneAndUpdate({
      ...scope, revision: dto.revision,
      $or: [{ state: 'available' }, { state: 'checked_out', dueAt: { $lte: startsAt } }],
      reservations: { $not: { $elemMatch: {
        cancelledAt: { $exists: false }, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt },
      } } },
    }, {
      $inc: { revision: 1 },
      $push: { reservations: { startsAt, endsAt, holder: dto.holder.trim(), activity: dto.activity.trim(), actorId: user.sub } },
    }, { new: true, projection: { history: 0 } }).lean();
    if (!result) throw new ConflictException('The asset is unavailable for that time or was just updated.');
    return result;
  }

  @Patch(':id/transfer')
  async transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransferAssetDto) {
    const scope = await this.assetScope(user, id);
    await this.requireBranch(user, dto.branchId);
    const destination = new Types.ObjectId(dto.branchId);
    const current = await this.assets.findOne(scope).select('branchId').lean();
    if (!current) throw new NotFoundException('Asset not found.');
    if (current.branchId.equals(destination)) throw new BadRequestException('Select a different branch.');
    const now = new Date();
    const result = await this.assets.updateOne({
      ...scope, revision: dto.revision, state: 'available', kitId: { $exists: false },
      reservations: { $not: { $elemMatch: { cancelledAt: { $exists: false }, endsAt: { $gt: now } } } },
    }, {
      $set: { branchId: destination, location: dto.location.trim() },
      $inc: { revision: 1 },
      $push: { history: { state: 'available', at: now, actorId: user.sub, actorEmail: user.email,
        fromBranchId: current.branchId, toBranchId: destination } },
    });
    if (!result.modifiedCount) throw new ConflictException('Only available assets without upcoming reservations can be transferred.');
    return { saved: true };
  }

  @Patch(':id/reservations/cancel')
  async cancelReservation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssetReservationKeyDto) {
    const scope = await this.assetScope(user, id);
    const startsAt = new Date(dto.startsAt);
    const result = await this.assets.updateOne({
      ...scope, revision: dto.revision, reservations: { $elemMatch: {
        startsAt, endsAt: { $gt: new Date() }, cancelledAt: { $exists: false },
      } },
    }, {
      $inc: { revision: 1 },
      $set: { 'reservations.$.cancelledAt': new Date(), 'reservations.$.cancelledBy': user.sub },
    });
    if (!result.modifiedCount) throw new ConflictException('This reservation is no longer available to cancel.');
    return { saved: true };
  }

  private async assetScope(user: AuthUser, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Asset not found.');
    return { _id: id, ...await this.access.buildBranchObjectIdFilter(user) };
  }
}
