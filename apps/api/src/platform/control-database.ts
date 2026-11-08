import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type {
  OperatorRecord,
  PlanRecord,
  PlatformAuditRecord,
  SubscriptionRecord,
  WorkspaceRecord,
} from './platform.types';

/*
 * The control database sits beside the workspace databases on the same cluster. Every API
 * worker reads its own subscription from it; only the control plane (the primary API with
 * PLATFORM_ENABLED) writes to it. Without CONTROL_DATABASE_NAME nothing here is used and the
 * API behaves exactly as before.
 */

@Injectable()
export class ControlDatabase implements OnModuleInit {
  private readonly operatorApiEnabled: boolean;
  readonly name?: string;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    config: ConfigService,
  ) {
    this.name = config.get<string>('controlDatabaseName') || undefined;
    this.operatorApiEnabled = config.get<boolean>('platformEnabled') === true;
  }

  get enabled() {
    return !!this.name;
  }

  async onModuleInit() {
    if (!this.name) return;
    if (this.name.toLowerCase() === this.connection.name.toLowerCase()) {
      throw new Error(
        'The control database must be separate from every workspace database.',
      );
    }
    if (!this.operatorApiEnabled) return;
    await Promise.all([
      this.operators.createIndex({ email: 1 }, { unique: true }),
      this.audit.createIndex({ at: -1 }),
      this.audit.createIndex({ workspaceId: 1, at: -1 }),
    ]);
  }

  private get db() {
    if (!this.name) throw new Error('The control database is not configured.');
    return this.connection.getClient().db(this.name);
  }

  /** The database this API itself runs on. */
  get primaryDatabaseName() {
    return this.connection.name;
  }

  /** A raw handle on another database on the cluster, for provisioning and usage counts. */
  database(name: string) {
    return this.connection.getClient().db(name);
  }

  /** A Mongoose connection for another database, for the workspace binding check. */
  workspaceConnection(name: string) {
    return this.connection.useDb(name, { useCache: false });
  }

  get workspaces() {
    return this.db.collection<WorkspaceRecord>('workspaces');
  }

  get operators() {
    return this.db.collection<OperatorRecord>('operators');
  }

  get plans() {
    return this.db.collection<PlanRecord>('plans');
  }

  get subscriptions() {
    return this.db.collection<SubscriptionRecord>('subscriptions');
  }

  get audit() {
    return this.db.collection<PlatformAuditRecord>('operator_audit');
  }
}
