import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomInt } from 'node:crypto';
import {
  FIRST_WORKSPACE_ID,
  bindWorkspaceDatabase,
  getWorkspace,
} from '../workspaces/workspace-boundary';
import { ControlDatabase } from './control-database';
import type { OperatorClaims } from './operators.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';
import {
  HANDLE_PATTERN,
  RESERVED_HANDLES,
  type WorkspaceRecord,
  type WorkspaceStatus,
} from './platform.types';
import { sealSecret } from './workspace-secrets';

export type WorkspaceView = {
  id: string;
  name: string;
  status: WorkspaceStatus;
  primary: boolean;
  databaseName?: string;
  adminEmail?: string;
  ownerEmail?: string;
  region?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  suspendedAt?: Date;
  suspensionReason?: string;
  archivedAt?: Date;
};

export type ProvisionInput = {
  handle: string;
  name: string;
  adminEmail: string;
  ownerEmail?: string;
  region?: string;
  notes?: string;
  planId?: string;
};

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

function generatePassword(length = 20) {
  let out = '';
  for (let i = 0; i < length; i++)
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/*
 * The tenant directory. Provisioning creates the record, seals its secrets, claims an empty
 * database and starts a trial; the gateway then boots the workspace on its first request and
 * seeds the first admin from the sealed credentials.
 */
@Injectable()
export class PlatformWorkspacesService {
  private readonly primary: { id: string; name: string };

  constructor(
    private readonly control: ControlDatabase,
    private readonly audit: PlatformAuditService,
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly config: ConfigService,
  ) {
    this.primary = getWorkspace(config);
  }

  private view(record: WorkspaceRecord): WorkspaceView {
    return {
      id: record._id,
      name: record.name,
      status: record.status,
      primary: false,
      databaseName: record.databaseName,
      adminEmail: record.adminEmail,
      ownerEmail: record.ownerEmail,
      region: record.region,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      suspendedAt: record.suspendedAt,
      suspensionReason: record.suspensionReason,
      archivedAt: record.archivedAt,
    };
  }

  private primaryView(): WorkspaceView {
    return {
      id: this.primary.id,
      name: this.primary.name,
      status: 'active',
      primary: true,
    };
  }

  isReserved(handle: string) {
    const extra = (process.env.CHUFLOW_RESERVED_WORKSPACE_HANDLES ?? '')
      .split(',')
      .map((value) => value.trim());
    return (
      handle === FIRST_WORKSPACE_ID ||
      handle === this.primary.id ||
      RESERVED_HANDLES.includes(handle) ||
      extra.includes(handle)
    );
  }

  async list(status?: WorkspaceStatus) {
    const records = await this.control.workspaces
      .find(status ? { status } : {})
      .sort({ createdAt: 1 })
      .toArray();
    const views = records.map((record) => this.view(record));
    return !status || status === 'active'
      ? [this.primaryView(), ...views]
      : views;
  }

  async get(id: string) {
    if (id === this.primary.id) return this.primaryView();
    const record = await this.control.workspaces.findOne({ _id: id });
    if (!record) throw new NotFoundException('Workspace not found');
    return this.view(record);
  }

  /** Workspace plus its subscription and what it is entitled to right now. */
  async detail(id: string) {
    const [workspace, subscription, entitlements] = await Promise.all([
      this.get(id),
      this.subscriptions.get(id),
      this.subscriptions.snapshot(id),
    ]);
    return { workspace, subscription, entitlements };
  }

  async provision(operator: OperatorClaims, input: ProvisionInput) {
    const handle = input.handle.trim().toLowerCase();
    if (!HANDLE_PATTERN.test(handle))
      throw new BadRequestException({
        code: 'workspace_handle_invalid',
        message: 'Enter a valid workspace handle.',
      });
    if (this.isReserved(handle))
      throw new ConflictException({
        code: 'workspace_handle_taken',
        message: 'This workspace handle is already in use.',
      });
    if (await this.control.workspaces.findOne({ _id: handle })) {
      throw new ConflictException({
        code: 'workspace_handle_taken',
        message: 'This workspace handle is already in use.',
      });
    }
    const key = this.config.get<string>('controlEncryptionKey');
    if (!key)
      throw new BadRequestException(
        'CONTROL_ENCRYPTION_KEY is required to provision workspaces.',
      );

    const databaseName = `chuflow_${handle.replace(/-/g, '_')}`.slice(0, 63);
    const adminPassword = generatePassword();
    const jwtSecret = randomBytes(32).toString('hex');
    const now = new Date();
    const record: WorkspaceRecord = {
      _id: handle,
      name: input.name.trim(),
      status: 'provisioning',
      databaseName,
      jwtSecret: sealSecret(jwtSecret, key),
      adminEmail: input.adminEmail.trim().toLowerCase(),
      adminPassword: sealSecret(adminPassword, key),
      ownerEmail: input.ownerEmail?.trim().toLowerCase() || undefined,
      region: input.region?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      createdBy: operator.email,
      updatedAt: now,
    };

    try {
      await this.control.workspaces.insertOne(record);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 11000
      ) {
        throw new ConflictException({
          code: 'workspace_handle_taken',
          message: 'This workspace handle is already in use.',
        });
      }
      throw error;
    }

    try {
      // Claims an empty database for this handle; refuses one that holds another church's data.
      await bindWorkspaceDatabase(
        this.control.workspaceConnection(databaseName),
        handle,
      );
      await this.subscriptions.startTrial(handle, input.planId ?? 'trial', now);
      await this.control.workspaces.updateOne(
        { _id: handle },
        { $set: { status: 'active', updatedAt: new Date() } },
      );
    } catch (error) {
      await this.control.workspaces.deleteOne({
        _id: handle,
        status: 'provisioning',
      });
      throw new ConflictException(
        `The workspace could not be provisioned: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    await this.audit.record(operator, 'workspace.provisioned', {
      workspaceId: handle,
      details: { databaseName, adminEmail: record.adminEmail },
    });
    const workspace = await this.get(handle);
    // The only time the first admin password is shown; it is stored sealed for the worker.
    return { workspace, adminEmail: record.adminEmail, adminPassword };
  }

  async update(
    operator: OperatorClaims,
    id: string,
    patch: {
      name?: string;
      ownerEmail?: string;
      region?: string;
      notes?: string;
    },
  ) {
    if (id === this.primary.id)
      throw new BadRequestException(
        'The primary workspace is configured by environment.',
      );
    const set: Partial<WorkspaceRecord> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name.trim();
    if (patch.ownerEmail !== undefined)
      set.ownerEmail = patch.ownerEmail.trim().toLowerCase() || undefined;
    if (patch.region !== undefined)
      set.region = patch.region.trim() || undefined;
    if (patch.notes !== undefined) set.notes = patch.notes.trim() || undefined;
    const result = await this.control.workspaces.findOneAndUpdate(
      { _id: id },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (!result) throw new NotFoundException('Workspace not found');
    await this.audit.record(operator, 'workspace.updated', {
      workspaceId: id,
      details: { fields: Object.keys(patch) },
    });
    return this.view(result);
  }

  private async transition(
    operator: OperatorClaims,
    id: string,
    from: WorkspaceStatus[],
    to: WorkspaceStatus,
    reason: string | undefined,
    extra: Partial<WorkspaceRecord>,
  ) {
    if (id === this.primary.id)
      throw new BadRequestException(
        'The primary workspace cannot change status here.',
      );
    const result = await this.control.workspaces.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { status: to, updatedAt: new Date(), ...extra } },
      { returnDocument: 'after' },
    );
    if (!result) {
      const current = await this.control.workspaces.findOne({ _id: id });
      if (!current) throw new NotFoundException('Workspace not found');
      throw new ConflictException(
        `A ${current.status} workspace cannot become ${to}.`,
      );
    }
    await this.audit.record(operator, `workspace.${to}`, {
      workspaceId: id,
      reason,
    });
    return this.view(result);
  }

  suspend(operator: OperatorClaims, id: string, reason: string) {
    return this.transition(operator, id, ['active'], 'suspended', reason, {
      suspendedAt: new Date(),
      suspensionReason: reason.trim(),
    });
  }

  reactivate(operator: OperatorClaims, id: string, reason?: string) {
    return this.transition(operator, id, ['suspended'], 'active', reason, {
      suspendedAt: undefined,
      suspensionReason: undefined,
    });
  }

  archive(operator: OperatorClaims, id: string, reason: string) {
    return this.transition(
      operator,
      id,
      ['active', 'suspended'],
      'archived',
      reason,
      { archivedAt: new Date() },
    );
  }

  /** Counts straight from the workspace's database, next to its quotas. */
  async usage(id: string) {
    let databaseName: string;
    if (id === this.primary.id) {
      databaseName = this.control.primaryDatabaseName;
    } else {
      const record = await this.control.workspaces.findOne({ _id: id });
      if (!record) throw new NotFoundException('Workspace not found');
      databaseName = record.databaseName;
    }
    const db = this.control.database(databaseName);
    const [branches, users, members, children, guests, snapshot] =
      await Promise.all([
        db.collection('branches').countDocuments({}),
        db.collection('users').countDocuments({ isActive: true }),
        db.collection('members').countDocuments({}),
        db.collection('childprofiles').countDocuments({ isActive: true }),
        db.collection('guests').countDocuments({}),
        this.subscriptions.snapshot(id),
      ]);
    return {
      counts: { branches, users, members, children, guests },
      quotas: snapshot.quotas,
      plan: snapshot.planId,
      access: snapshot.access,
    };
  }
}
