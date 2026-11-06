import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { LEADERSHIP_ROLES } from '../common/constants/roles.constants';
import { Guest } from '../guests/schemas/guest.schema';
import { Member } from '../members/schemas/member.schema';
import { ServiceUnit } from '../service-units/schemas/service-unit.schema';
import { Branch } from '../branches/schemas/branch.schema';
import { ImportBatch, ImportRow, ImportLock } from './import.schema';
import { StartImportDto, UploadImportDto, CommitImportDto } from './import.dto';
import {
  IMPORT_FIELDS,
  type ImportKind,
  checkValues,
  identityKeys,
  normalizeImport,
  recordId,
  rowHash,
} from './import.logic';
@Injectable()
export class ImportService {
  constructor(
    @InjectModel(ImportBatch.name) private readonly batches: Model<ImportBatch>,
    @InjectModel(ImportRow.name) private readonly rows: Model<ImportRow>,
    @InjectModel(ImportLock.name) private readonly locks: Model<ImportLock>,
    @InjectModel(Guest.name) private readonly guests: Model<Guest>,
    @InjectModel(Member.name) private readonly members: Model<Member>,
    @InjectModel(ServiceUnit.name) private readonly units: Model<ServiceUnit>,
    @InjectModel(Branch.name) private readonly branches: Model<Branch>,
    private readonly scope: AccessScopeService,
    private readonly audit: AuditLogsService,
  ) {}
  private role(u: AuthUser) {
    if (!LEADERSHIP_ROLES.includes(u.role))
      throw new ForbiddenException(
        'Church leadership access is required to import records.',
      );
  }
  private id(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Import not found.');
    return new Types.ObjectId(id);
  }
  private target(kind: string) {
    return (kind === 'guests'
      ? this.guests
      : kind === 'members'
        ? this.members
        : this.units) as unknown as Model<Record<string, unknown>>;
  }
  private async access(u: AuthUser, id: string) {
    this.role(u);
    const job = await this.batches.findById(this.id(id)).lean();
    if (!job || job.expiresAt <= new Date())
      throw new NotFoundException(
        'Import not found or its 30-day retention period has ended.',
      );
    await this.scope.ensureBranchAccess(u, String(job.branchId));
    if (!(await this.branches.exists({ _id: job.branchId, status: 'active' })))
      throw new BadRequestException('Select an active church.');
    return job;
  }
  async options(u: AuthUser) {
    this.role(u);
    return {
      branches: await this.branches
        .find({
          $and: [
            await this.scope.getBranchDocumentQuery(u),
            { status: 'active' },
          ],
        })
        .select('_id name')
        .sort({ name: 1 })
        .lean(),
      fields: IMPORT_FIELDS,
      maxRows: 10000,
    };
  }
  async list(u: AuthUser) {
    this.role(u);
    return this.batches
      .find(await this.scope.buildBranchObjectIdFilter(u))
      .select(
        '_id kind branchId status expectedRows valid invalid duplicates createdAt',
      )
      .sort({ _id: -1 })
      .limit(15)
      .lean();
  }
  async start(u: AuthUser, d: StartImportDto) {
    this.role(u);
    await this.scope.ensureBranchAccess(u, d.branchId);
    if (!(await this.branches.exists({ _id: d.branchId, status: 'active' })))
      throw new BadRequestException('Select an active church.');
    const old = await this.batches
      .findOne({ createdBy: u.sub, requestKey: d.requestKey })
      .lean();
    if (old) {
      if (
        String(old.branchId) !== d.branchId ||
        old.kind !== d.kind ||
        old.expectedRows !== d.expectedRows ||
        old.dateFormat !== d.dateFormat
      )
        throw new ConflictException('Start a new import for this file.');
      return { _id: String(old._id) };
    }
    try {
      const job = await this.batches.create({
        ...d,
        createdBy: u.sub,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      });
      return { _id: String(job._id) };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        const job = await this.batches
          .findOne({ createdBy: u.sub, requestKey: d.requestKey })
          .lean();
        if (job) {
          if (
            String(job.branchId) !== d.branchId ||
            job.kind !== d.kind ||
            job.expectedRows !== d.expectedRows ||
            job.dateFormat !== d.dateFormat
          )
            throw new ConflictException('Start a new import for this file.');
          return { _id: String(job._id) };
        }
      }
      throw e;
    }
  }
  async upload(u: AuthUser, id: string, d: UploadImportDto) {
    const job = await this.access(u, id);
    if (job.status !== 'uploading')
      throw new ConflictException('This import has already been reviewed.');
    if (d.offset + d.rows.length > job.expectedRows)
      throw new BadRequestException('Too many rows.');
    const inputs = d.rows.map((row, i) => {
      try {
        checkValues(job.kind as ImportKind, row.values);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      return {
        ...row,
        position: d.offset + i,
        _id: recordId(id, d.offset + i),
        hash: rowHash(row.sourceRow, row.values),
      };
    });
    const existing = await this.rows
      .find({ _id: { $in: inputs.map((r) => r._id) } })
      .select('_id hash')
      .lean();
    const hashes = new Map(existing.map((r) => [String(r._id), r.hash]));
    if (
      inputs.some(
        (r) =>
          hashes.has(String(r._id)) && hashes.get(String(r._id)) !== r.hash,
      )
    )
      throw new ConflictException(
        'The uploaded rows changed. Start a new import.',
      );
    try {
      await this.rows.bulkWrite(
        inputs.map((row) => ({
          updateOne: {
            filter: { _id: row._id, hash: row.hash },
            update: {
              $setOnInsert: {
                batchId: job._id,
                position: row.position,
                sourceRow: row.sourceRow,
                values: row.values,
                hash: row.hash,
                status: 'uploaded',
                expiresAt: job.expiresAt,
              },
            },
            upsert: true,
          },
        })),
      );
    } catch (e) {
      if ((e as { code?: number }).code === 11000)
        throw new ConflictException(
          'The uploaded rows changed. Start a new import.',
        );
      throw e;
    }
    return { uploaded: await this.rows.countDocuments({ batchId: job._id }) };
  }
  private async claim(id: Types.ObjectId, statuses: string[], state: string) {
    const lease = randomUUID();
    const now = new Date();
    const job = await this.batches
      .findOneAndUpdate(
        {
          _id: id,
          status: { $in: statuses },
          $or: [
            { leaseUntil: { $exists: false } },
            { leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            status: state,
            lease,
            leaseUntil: new Date(Date.now() + 240000),
          },
        },
        { new: true },
      )
      .lean();
    if (!job)
      throw new ConflictException(
        'This import is being processed. Wait a moment and refresh.',
      );
    return { job, lease };
  }
  async validate(u: AuthUser, id: string) {
    const initial = await this.access(u, id);
    if (initial.status === 'ready') return this.detail(u, id);
    if (
      (await this.rows.countDocuments({ batchId: initial._id })) !==
      initial.expectedRows
    )
      throw new BadRequestException(
        'Finish uploading the file before reviewing it.',
      );
    const { job, lease } = await this.claim(
      initial._id,
      ['uploading', 'validating'],
      'validating',
    );
    try {
      const [rows, guests, members, units] = await Promise.all([
        this.rows.find({ batchId: job._id }).sort({ position: 1 }).lean(),
        this.guests
          .find({ branchId: job.branchId })
          .select('firstName lastName email phone')
          .lean(),
        this.members
          .find({ branchId: job.branchId })
          .select('firstName lastName email phone')
          .lean(),
        this.units
          .find({ branchId: job.branchId })
          .select('_id name isActive')
          .lean(),
      ]);
      const known = new Set<string>();
      for (const r of job.kind === 'service_units'
        ? units
        : [...guests, ...members])
        for (const key of identityKeys(r, job.kind)) known.add(key);
      const groups = new Map(
        units
          .filter((g) => g.isActive)
          .map((g) => [g.name.toLowerCase(), String(g._id)]),
      );
      let valid = 0,
        duplicates = 0,
        invalid = 0;
      const updates: {
        updateOne: {
          filter: { _id: Types.ObjectId };
          update: {
            $set: {
              normalized: Record<string, unknown>;
              status: string;
              reason: string;
            };
          };
        };
      }[] = [];
      for (const row of rows) {
        let status = 'ready',
          reason = '';
        let normalized: Record<string, unknown> = {};
        try {
          normalized = normalizeImport(
            job.kind as ImportKind,
            row.values,
            job.dateFormat,
            groups,
          );
          const keys = identityKeys(normalized, job.kind);
          if (keys.some((k) => known.has(k))) {
            status = 'duplicate';
            reason =
              'Possible duplicate in this file or an existing guest/member/group in this church. Existing records are unchanged.';
            duplicates++;
          } else {
            keys.forEach((k) => known.add(k));
            valid++;
          }
        } catch (e) {
          status = 'invalid';
          reason = (e as Error).message;
          invalid++;
        }
        updates.push({
          updateOne: {
            filter: { _id: row._id },
            update: { $set: { normalized, status, reason } },
          },
        });
        if (row.position % 1000 === 0) {
          const renewed = await this.batches.updateOne(
            { _id: job._id, lease },
            { $set: { leaseUntil: new Date(Date.now() + 240000) } },
          );
          if (!renewed.matchedCount)
            throw new ConflictException(
              'Import review changed. Please refresh.',
            );
        }
      }
      await this.rows.bulkWrite(updates);
      await this.batches.updateOne(
        { _id: job._id, lease },
        {
          $set: {
            status: 'ready',
            valid,
            duplicates,
            invalid,
            validatedAt: new Date(),
          },
          $unset: { lease: 1, leaseUntil: 1 },
        },
      );
      return this.detail(u, id);
    } catch (e) {
      await this.batches.updateOne(
        { _id: job._id, lease },
        { $set: { status: 'uploading' }, $unset: { lease: 1, leaseUntil: 1 } },
      );
      throw e;
    }
  }
  async detail(u: AuthUser, id: string, page = '1', status = '') {
    const job = await this.access(u, id);
    const current = Math.min(1000, Math.max(1, Number(page) || 1));
    const filter = {
      batchId: job._id,
      ...(['ready', 'invalid', 'duplicate', 'imported', 'failed'].includes(
        status,
      )
        ? { status }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.rows
        .find(filter)
        .select('position sourceRow values normalized status reason')
        .sort({ position: 1 })
        .skip((current - 1) * 25)
        .limit(25)
        .lean(),
      this.rows.countDocuments(filter),
      this.rows.aggregate<{ _id: string; count: number }>([
        { $match: { batchId: job._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    return {
      job: {
        _id: String(job._id),
        branchId: String(job.branchId),
        kind: job.kind,
        status: job.status,
        expectedRows: job.expectedRows,
        valid: job.valid,
        invalid: job.invalid,
        duplicates: job.duplicates,
        expiresAt: job.expiresAt,
      },
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
      rows,
      pagination: {
        page: current,
        total,
        totalPages: Math.max(1, Math.ceil(total / 25)),
      },
    };
  }
  async resultRows(u: AuthUser, id: string) {
    const job = await this.access(u, id);
    return {
      kind: job.kind as ImportKind,
      rows: this.rows
        .find({ batchId: job._id })
        .select('sourceRow values status reason')
        .sort({ position: 1 })
        .cursor(),
    };
  }
  private async duplicate(
    kind: string,
    branchId: Types.ObjectId,
    data: Record<string, unknown>,
  ) {
    const escape = (v: unknown) =>
      String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (kind === 'service_units')
      return !!(await this.units.exists({
        branchId,
        name: { $regex: '^' + escape(data.name) + '$', $options: 'i' },
      }));
    const choices: Record<string, unknown>[] = [];
    if (data.email)
      choices.push({
        email: { $regex: '^' + escape(data.email) + '$', $options: 'i' },
      });
    if (data.phone) {
      const digits = String(data.phone).replace(/\D/g, '');
      const tail = digits.length >= 10 ? digits.slice(-10) : digits;
      choices.push({
        phone: { $regex: tail.split('').join('\\D*') + '\\D*$' },
      });
    }
    if (!choices.length)
      choices.push({
        firstName: {
          $regex: '^' + escape(data.firstName) + '$',
          $options: 'i',
        },
        lastName: { $regex: '^' + escape(data.lastName) + '$', $options: 'i' },
      });
    const query = { branchId, $or: choices };
    return !!(
      (await this.guests.exists(query)) || (await this.members.exists(query))
    );
  }
  async commit(u: AuthUser, id: string, d: CommitImportDto) {
    const old = await this.access(u, id);
    if (String(old.branchId) !== d.branchId || old.valid !== d.expectedValid)
      throw new ConflictException(
        'Review the church and valid-row count again.',
      );
    if (old.status === 'completed') return this.detail(u, id);
    if (old.status === 'ready') {
      const changed = await this.batches.updateOne(
        { _id: old._id, status: 'ready' },
        { $set: { status: 'importing' } },
      );
      if (changed.modifiedCount)
        await this.audit
          .record({
            actor: u,
            entityType: 'import',
            entityId: id,
            action: 'started',
            summary: `Import started: ${old.kind}, ${old.valid} reviewed rows`,
            branchId: String(old.branchId),
          })
          .catch(() => undefined);
    }
    return this.step(u, id);
  }
  async step(u: AuthUser, id: string) {
    const initial = await this.access(u, id);
    if (initial.status === 'completed') return this.detail(u, id);
    const { job, lease } = await this.claim(
      initial._id,
      ['importing'],
      'importing',
    );
    let branchLocked = false;
    try {
      try {
        await this.locks.findOneAndUpdate(
          {
            _id: String(job.branchId),
            $or: [{ until: { $lte: new Date() } }, { owner: lease }],
          },
          { $set: { owner: lease, until: new Date(Date.now() + 240000) } },
          { upsert: true, new: true },
        );
        branchLocked = true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000)
          throw new ConflictException(
            'Another import is running for this church. Retry shortly.',
          );
        throw e;
      }
      const rows = await this.rows
        .find({ batchId: job._id, status: 'ready' })
        .sort({ position: 1 })
        .limit(20)
        .lean();
      const target = this.target(job.kind);
      for (const row of rows) {
        const data = row.normalized || {};
        const targetId = recordId(id, row.position);
        const existing = await target
          .findOne({ _id: targetId, importBatchId: job._id })
          .select('_id')
          .lean();
        if (!existing && (await this.duplicate(job.kind, job.branchId, data))) {
          await this.rows.updateOne(
            { _id: row._id, status: 'ready' },
            {
              $set: {
                status: 'duplicate',
                reason:
                  'A matching record was added after review. Skipped; existing record unchanged.',
              },
            },
          );
          continue;
        }
        if (!existing)
          await target.updateOne(
            { _id: targetId, importBatchId: job._id },
            {
              $setOnInsert: {
                ...data,
                branchId: job.branchId,
                importBatchId: job._id,
                importedAt: new Date(),
              },
            },
            { upsert: true, runValidators: true },
          );
        await this.rows.updateOne(
          { _id: row._id },
          { $set: { status: 'imported', reason: '' } },
        );
        await this.locks.updateOne(
          { _id: String(job.branchId), owner: lease },
          { $set: { until: new Date(Date.now() + 240000) } },
        );
        const renewed = await this.batches.updateOne(
          { _id: job._id, lease },
          { $set: { leaseUntil: new Date(Date.now() + 240000) } },
        );
        if (!renewed.matchedCount)
          throw new ConflictException(
            'Import processing changed. Refresh to resume.',
          );
      }
      if (!(await this.rows.exists({ batchId: job._id, status: 'ready' }))) {
        await this.batches.updateOne(
          { _id: job._id, lease },
          { $set: { status: 'completed' } },
        );
        await this.audit
          .record({
            actor: u,
            entityType: 'import',
            entityId: id,
            action: 'completed',
            summary: `Import completed: ${job.kind}`,
            branchId: String(job.branchId),
          })
          .catch(() => undefined);
      }
    } finally {
      if (branchLocked)
        await this.locks.deleteOne({ _id: String(job.branchId), owner: lease });
      await this.batches.updateOne(
        { _id: job._id, lease },
        { $unset: { lease: 1, leaseUntil: 1 } },
      );
    }
    return this.detail(u, id);
  }
}
