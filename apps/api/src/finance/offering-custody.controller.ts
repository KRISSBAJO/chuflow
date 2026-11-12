import {
  BadRequestException, Body, ConflictException, Controller, Get,
  NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JsonSubmissionGuard } from '../common/guards/json-submission.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { RequiresFeature } from '../platform/requires-feature.decorator';
import { User } from '../users/schemas/user.schema';
import { IssueBagDto, ReceiveBagDto, RecordCountDto, RecordDepositDto } from './dto/offering-custody.dto';
import { OfferingCustody } from './schemas/offering-custody.schema';
import { OfferingEntry } from './schemas/offering-entry.schema';

@Controller('finance/offerings/:id/custody')
@UseGuards(JwtAuthGuard, JsonSubmissionGuard)
@Roles(...LEADERSHIP_ROLES)
@RequiresFeature('finance')
export class OfferingCustodyController {
  constructor(
    @InjectModel(OfferingEntry.name) private readonly offerings: Model<OfferingEntry>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly access: AccessScopeService,
  ) {}

  @Get()
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { entry, custody } = await this.load(user, id);
    const actorIds = new Set(custody.bags.flatMap(bag => [bag.issuedBy, bag.receivedBy]));
    if (custody.second) {
      actorIds.add(custody.first?.by);
      actorIds.add(custody.second.by);
    }
    actorIds.add(custody.deposit?.by);
    const people = await this.users.find({
      _id: { $in: [...actorIds].filter(id => id && Types.ObjectId.isValid(id)) },
    }).select('firstName lastName').lean();
    const names = new Map(people.map(person => [String(person._id), [person.firstName, person.lastName].filter(Boolean).join(' ')]));
    return {
      revision: custody.revision,
      currency: custody.currency,
      minorDigits: this.minorDigits(custody.currency),
      title: entry.offeringTypeLabel,
      service: entry.serviceLabel ?? entry.serviceTypeLabel,
      serviceDate: entry.serviceDate,
      status: entry.status,
      canIssue: !custody.first && !custody.mismatches.length && !custody.deposit && entry.status !== 'rejected',
      bags: custody.bags.map(bag => ({
        ...bag,
        issuerName: names.get(bag.issuedBy),
        receiverName: bag.receivedBy ? names.get(bag.receivedBy) : undefined,
        seal: bag.receivedAt || bag.issuedBy === user.sub ? bag.seal : undefined,
        canReceive: !bag.receivedAt && bag.issuedBy !== user.sub,
      })),
      countPending: Boolean(custody.first && !custody.second),
      canVerify: Boolean(custody.first && !custody.second && custody.first.by !== user.sub),
      mismatchCount: custody.mismatches.length / 2,
      verifiedMinor: custody.second?.minor,
      counters: custody.second ? [custody.first, custody.second].flatMap(count =>
        count ? [{ name: names.get(count.by), at: count.at }] : [],
      ) : [],
      deposit: custody.deposit ? { ...custody.deposit, recorderName: names.get(custody.deposit.by) } : undefined,
    };
  }

  @Post('issue')
  async issue(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: IssueBagDto) {
    const loaded = await this.load(user, id);
    const { custody } = loaded;
    this.requireOpen(loaded, dto.revision);
    if (custody.first || custody.mismatches.length || custody.bags.length >= 100) throw new ConflictException('Bag issue is closed.');
    const label = dto.label.trim().toUpperCase();
    const seal = dto.seal.trim().toUpperCase();
    if (custody.bags.some(bag => bag.label === label || bag.seal === seal)) {
      throw new ConflictException('This bag or seal is already recorded.');
    }
    custody.bags.push({ label, seal, collector: dto.collector.trim(), issuedAt: new Date(), issuedBy: user.sub });
    return this.save(loaded);
  }

  @Post('receive')
  async receive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReceiveBagDto) {
    const loaded = await this.load(user, id);
    this.requireOpen(loaded, dto.revision);
    const bag = loaded.custody.bags.find(item => item.label === dto.label.trim().toUpperCase());
    if (!bag || bag.receivedAt || bag.issuedBy === user.sub) {
      throw new ConflictException('A different staff member must receive an outstanding bag.');
    }
    if (bag.seal !== dto.seal.trim().toUpperCase()) {
      throw new BadRequestException('The seal does not match the recorded seal.');
    }
    bag.receivedAt = new Date();
    bag.receivedBy = user.sub;
    return this.save(loaded);
  }

  @Post('count')
  async count(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordCountDto) {
    const loaded = await this.load(user, id);
    const { custody } = loaded;
    this.requireOpen(loaded, dto.revision);
    if (!custody.bags.length || custody.bags.some(bag => !bag.receivedAt) || custody.second) {
      throw new ConflictException('All sealed bags must be received before counting.');
    }
    const count = { minor: dto.minor, by: user.sub, at: new Date() };
    if (!custody.first) {
      custody.first = count;
      return this.save(loaded);
    }
    if (custody.first.by === user.sub) throw new ConflictException('A different staff member must verify the count.');
    if (custody.first.minor !== count.minor) {
      custody.mismatches.push(custody.first, count);
      delete custody.first;
      await this.save(loaded);
      return { saved: true, mismatch: true };
    }
    custody.second = count;
    return this.save(loaded);
  }

  @Post('deposit')
  async deposit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RecordDepositDto) {
    const loaded = await this.load(user, id);
    const { entry, custody } = loaded;
    this.requireOpen(loaded, dto.revision);
    if (!custody.second || !['approved', 'locked'].includes(entry.status)) {
      throw new ConflictException('Verify the count and approve the offering before recording the deposit.');
    }
    const date = new Date(dto.date + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dto.date || date.getTime() > Date.now()) {
      throw new BadRequestException('Choose a valid deposit date on or before today.');
    }
    const scaled = entry.amount * 10 ** this.minorDigits(custody.currency);
    const offeringMinor = Math.round(scaled);
    if (Math.abs(scaled - offeringMinor) > 0.00001 || dto.minor !== offeringMinor || dto.minor !== custody.second.minor) {
      throw new ConflictException('The deposit, verified count and approved offering amount must match.');
    }
    custody.deposit = { reference: dto.reference.trim().toUpperCase(), date: dto.date, minor: dto.minor, by: user.sub, at: new Date() };
    return this.save(loaded, true);
  }

  private async load(user: AuthUser, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Offering entry not found.');
    const scope = await this.access.buildBranchObjectIdFilter(user);
    const entry = await this.offerings.findOne({ ...scope, _id: id }).select('+custody').lean();
    if (!entry) throw new NotFoundException('Offering entry not found.');
    const custody: OfferingCustody = entry.custody ?? {
      currency: (entry.currency || 'USD').toUpperCase(), revision: 0, bags: [], mismatches: [],
    };
    return { entry, custody, existed: Boolean(entry.custody), revision: custody.revision };
  }

  private requireOpen({ entry, custody, revision }: Awaited<ReturnType<OfferingCustodyController['load']>>, expected: number) {
    if (expected !== revision || custody.deposit || entry.status === 'rejected' || (entry.currency || 'USD').toUpperCase() !== custody.currency) {
      throw new ConflictException('Custody is closed or the offering changed. Reload before continuing.');
    }
  }

  private minorDigits(currency: string) {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  }

  private async save({ entry, custody, existed, revision }: Awaited<ReturnType<OfferingCustodyController['load']>>, reconciled = false) {
    try {
      const result = await this.offerings.updateOne({
        _id: entry._id, branchId: entry.branchId, status: entry.status,
        reviewRevision: entry.reviewRevision ?? { $exists: false },
        ...(existed ? { 'custody.revision': revision } : { custody: { $exists: false } }),
      }, {
        $set: {
          custody: { ...custody, revision: revision + 1 },
          ...(reconciled ? { custodyReconciledAt: custody.deposit?.at } : {}),
        },
        ...(reconciled ? { $inc: { reviewRevision: 1 } } : {}),
      });
      if (!result.modifiedCount) throw new ConflictException('The offering changed. Reload before continuing.');
      return { saved: true };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException('That seal or deposit reference is already in use.');
      throw error;
    }
  }
}
