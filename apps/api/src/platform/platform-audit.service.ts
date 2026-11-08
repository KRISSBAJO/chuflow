import { Injectable } from '@nestjs/common';
import { ControlDatabase } from './control-database';
import type { OperatorClaims } from './operators.service';

/** Every operator action that changes something is written here with who, what and why. */
@Injectable()
export class PlatformAuditService {
  constructor(private readonly control: ControlDatabase) {}

  async record(
    operator: OperatorClaims,
    action: string,
    input: {
      workspaceId?: string;
      reason?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    await this.control.audit.insertOne({
      at: new Date(),
      operatorId: operator.sub,
      operatorEmail: operator.email,
      action,
      workspaceId: input.workspaceId,
      reason: input.reason?.trim() || undefined,
      details: input.details,
    });
  }

  async list(filter: { workspaceId?: string; limit?: number }) {
    const query = filter.workspaceId ? { workspaceId: filter.workspaceId } : {};
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const entries = await this.control.audit
      .find(query)
      .sort({ at: -1 })
      .limit(limit)
      .toArray();
    return entries.map(({ _id, ...entry }) => ({ id: String(_id), ...entry }));
  }
}
