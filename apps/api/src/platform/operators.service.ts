import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { ControlDatabase } from './control-database';
import type { OperatorRecord, OperatorRole } from './platform.types';

export type OperatorClaims = {
  kind: 'operator';
  sub: string;
  email: string;
  role: OperatorRole;
};
type OperatorSession = OperatorClaims & { sessionVersion?: number };
export type OperatorView = {
  id: string;
  email: string;
  role: OperatorRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
};

const SESSION_HOURS = 8;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

/*
 * Operators are the people who run the platform. They are not church users: their accounts,
 * sessions and signing key are separate, so a compromised church account can never reach the
 * control plane and vice versa.
 */
@Injectable()
export class OperatorsService implements OnModuleInit {
  private readonly logger = new Logger(OperatorsService.name);
  private readonly jwt: JwtService;
  readonly enabled: boolean;
  private attempts = new Map<string, { count: number; until: number }>();

  constructor(
    private readonly control: ControlDatabase,
    private readonly config: ConfigService,
  ) {
    const secret = config.get<string>('platformJwtSecret');
    if (config.get<boolean>('platformEnabled') && secret === config.get<string>('jwtSecret')) {
      throw new Error('Platform and workspace signing keys must be distinct.');
    }
    this.enabled =
      !!config.get<boolean>('platformEnabled') && control.enabled && !!secret;
    this.jwt = new JwtService({
      secret: secret || 'platform-disabled',
      signOptions: { expiresIn: `${SESSION_HOURS}h` },
    });
  }

  async onModuleInit() {
    if (!this.enabled) return;
    const email = this.config
      .get<string>('platformOwnerEmail')
      ?.trim()
      .toLowerCase();
    const password = this.config.get<string>('platformOwnerPassword');
    if (!email || !password) return;
    const existing = await this.control.operators.findOne({ email });
    if (existing) return;
    await this.control.operators.insertOne({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'owner',
      isActive: true,
      createdAt: new Date(),
    });
    this.logger.log(`Platform owner ${email} created.`);
  }

  private throttle(key: string) {
    const now = Date.now();
    for (const [k, v] of this.attempts)
      if (v.until < now) this.attempts.delete(k);
    const entry = this.attempts.get(key) ?? {
      count: 0,
      until: now + ATTEMPT_WINDOW_MS,
    };
    if (
      entry.count >= ATTEMPT_LIMIT ||
      (!this.attempts.has(key) && this.attempts.size >= 10_000)
    ) {
      throw new HttpException(
        'Too many sign-in attempts. Try again later.',
        429,
      );
    }
    entry.count += 1;
    this.attempts.set(key, entry);
  }

  async login(email: string, password: string, ip: string) {
    this.throttle(ip);
    const normalized = email.trim().toLowerCase();
    const operator = await this.control.operators.findOne({
      email: normalized,
    });
    const ok =
      !!operator &&
      operator.isActive &&
      (await bcrypt.compare(password, operator.passwordHash));
    if (!operator || !ok)
      throw new UnauthorizedException('Invalid credentials');
    await this.control.operators.updateOne(
      { _id: operator._id },
      { $set: { lastLoginAt: new Date() } },
    );
    const claims: OperatorClaims = {
      kind: 'operator',
      sub: String(operator._id),
      email: operator.email,
      role: operator.role,
    };
    return {
      accessToken: await this.jwt.signAsync({
        ...claims,
        sessionVersion: operator.sessionVersion ?? 0,
      }),
      tokenType: 'Bearer',
      expiresIn: SESSION_HOURS * 3600,
      operator: this.view(operator),
    };
  }

  async verify(token: string): Promise<OperatorClaims> {
    let claims: OperatorSession;
    try {
      claims = await this.jwt.verifyAsync<OperatorSession>(token);
    } catch {
      throw new UnauthorizedException('Operator session expired or invalid.');
    }
    if (claims.kind !== 'operator' || !ObjectId.isValid(claims.sub))
      throw new UnauthorizedException('Operator session expired or invalid.');
    const operator = await this.control.operators.findOne({
      _id: new ObjectId(claims.sub),
    });
    if (!operator?.isActive || (claims.sessionVersion ?? 0) !== (operator.sessionVersion ?? 0))
      throw new UnauthorizedException('Operator session expired or invalid.');
    return {
      kind: 'operator',
      sub: String(operator._id),
      email: operator.email,
      role: operator.role,
    };
  }

  view(operator: OperatorRecord): OperatorView {
    return {
      id: String(operator._id),
      email: operator.email,
      role: operator.role,
      isActive: operator.isActive,
      createdAt: operator.createdAt,
      lastLoginAt: operator.lastLoginAt,
    };
  }

  async list() {
    const operators = await this.control.operators
      .find({})
      .sort({ createdAt: 1 })
      .toArray();
    return operators.map((operator) => this.view(operator));
  }

  async create(input: { email: string; password: string; role: OperatorRole }) {
    const email = input.email.trim().toLowerCase();
    if (await this.control.operators.findOne({ email }))
      throw new ConflictException(
        'An operator with this email already exists.',
      );
    const record: OperatorRecord = {
      email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      isActive: true,
      createdAt: new Date(),
    };
    const { insertedId } = await this.control.operators.insertOne(record);
    return this.view({ ...record, _id: insertedId });
  }

  async update(
    id: string,
    patch: { role?: OperatorRole; isActive?: boolean; password?: string },
    actorId: string,
  ) {
    if (!ObjectId.isValid(id))
      throw new NotFoundException('Operator not found');
    const _id = new ObjectId(id);
    const set: Partial<OperatorRecord> = {};
    if (patch.role) set.role = patch.role;
    if (patch.isActive !== undefined) set.isActive = patch.isActive;
    if (patch.password)
      set.passwordHash = await bcrypt.hash(patch.password, 10);
    if (
      id === actorId &&
      (patch.isActive === false || (patch.role && patch.role !== 'owner'))
    ) {
      throw new ConflictException(
        'You cannot lock yourself out of the platform.',
      );
    }
    if (set.isActive === false || (set.role && set.role !== 'owner')) {
      const owners = await this.control.operators.countDocuments({
        role: 'owner',
        isActive: true,
        _id: { $ne: _id },
      });
      const target = await this.control.operators.findOne({ _id });
      if (target?.role === 'owner' && owners === 0)
        throw new ConflictException('At least one active owner must remain.');
    }
    const result = await this.control.operators.findOneAndUpdate(
      { _id },
      {
        $set: set,
        ...(patch.password || patch.isActive === false ? { $inc: { sessionVersion: 1 } } : {}),
      },
      { returnDocument: 'after' },
    );
    if (!result) throw new NotFoundException('Operator not found');
    return this.view(result);
  }
}
