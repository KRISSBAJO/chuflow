import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection } from '@nestjs/mongoose';
import { createHmac, randomUUID } from 'node:crypto';
import type { Connection } from 'mongoose';
import { getWorkspace } from './workspace-boundary';

const ISSUER = 'chuflow-workspace-directory';
const BROWSER_ISSUER = 'chuflow-mobile-browser';
const LIFETIME_SECONDS = 60;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

type Membership = {
  _id: string;
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  targetUserId: string;
  enabled: boolean;
};

@Injectable()
export class WorkspaceAccessService implements OnModuleInit {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private key(name: string) {
    const value = this.config.get<string>(name);
    return value ? Buffer.from(value, 'base64').toString('utf8') : undefined;
  }

  private get memberships() {
    return this.connection.db!.collection<Membership>('workspace_memberships');
  }

  private get redemptions() {
    return this.connection.db!.collection<{ _id: string; expiresAt: Date }>(
      'workspace_handoff_redemptions',
    );
  }

  async onModuleInit() {
    if (this.key('workspaceDirectorySigningKey')) {
      await this.memberships.createIndex({ accountId: 1, enabled: 1 });
    }
    await this.redemptions.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );
  }

  async list(accountId: string) {
    const current = getWorkspace(this.config);
    const memberships = this.key('workspaceDirectorySigningKey')
      ? await this.memberships
          .find({ accountId, enabled: true })
          .sort({ workspaceName: 1 })
          .toArray()
      : [];
    return [
      { ...current, current: true },
      ...memberships
        .filter(({ workspaceId }) => workspaceId !== current.id)
        .map(({ workspaceId, workspaceName }) => ({
          id: workspaceId,
          name: workspaceName,
          current: false,
        })),
    ];
  }

  async createHandoff(accountId: string, workspaceId: string) {
    const key = this.key('workspaceDirectorySigningKey');
    if (!key) throw new NotFoundException();
    const membership = await this.memberships.findOne({
      _id: accountId + ':' + workspaceId,
      accountId,
      workspaceId,
      enabled: true,
    });
    if (
      !membership ||
      workspaceId === getWorkspace(this.config).id ||
      !OBJECT_ID.test(membership.targetUserId)
    ) {
      throw new ForbiddenException('Workspace access is unavailable.');
    }

    const handoff = await this.jwt.signAsync(
      {},
      {
        secret: key,
        algorithm: 'RS256',
        issuer: ISSUER,
        audience: workspaceId,
        subject: membership.targetUserId,
        jwtid: randomUUID(),
        expiresIn: LIFETIME_SECONDS,
      },
    );
    return { handoff, expiresIn: LIFETIME_SECONDS };
  }

  async createBrowserHandoff(userId: string) {
    const handoff = await this.jwt.signAsync({}, {
      secret: this.browserKey(),
      algorithm: 'HS256',
      issuer: BROWSER_ISSUER,
      audience: getWorkspace(this.config).id,
      subject: userId,
      jwtid: randomUUID(),
      expiresIn: LIFETIME_SECONDS,
    });
    return { handoff };
  }

  async redeem(handoff: string, browser = false) {
    const key = browser ? this.browserKey() : this.key('workspaceDirectoryVerificationKey');
    if (!key) throw new NotFoundException();
    let claims: { sub?: string; jti?: string; exp?: number };
    try {
      claims = await this.jwt.verifyAsync(handoff, {
        secret: key,
        algorithms: [browser ? 'HS256' : 'RS256'],
        issuer: browser ? BROWSER_ISSUER : ISSUER,
        audience: getWorkspace(this.config).id,
        maxAge: LIFETIME_SECONDS,
      });
    } catch {
      throw new UnauthorizedException('Workspace sign-in expired or invalid.');
    }

    const { sub, jti, exp } = claims;
    if (
      typeof sub !== 'string' ||
      !OBJECT_ID.test(sub) ||
      typeof jti !== 'string' ||
      jti.length > 64 ||
      typeof exp !== 'number'
    )
      throw new UnauthorizedException('Workspace sign-in expired or invalid.');

    try {
      await this.redemptions.insertOne({
        _id: jti,
        expiresAt: new Date(exp * 1000),
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new UnauthorizedException(
          'Workspace sign-in expired or invalid.',
        );
      }
      throw error;
    }
    return sub;
  }

  private browserKey() {
    return createHmac('sha256', this.config.getOrThrow<string>('jwtSecret'))
      .update(BROWSER_ISSUER)
      .digest('hex');
  }
}
