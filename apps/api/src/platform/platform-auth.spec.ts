import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import type { Server } from 'node:http';
import request from 'supertest';
import { ControlDatabase } from './control-database';
import { OperatorsService } from './operators.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';
import { PlatformWorkspacesService } from './platform-workspaces.service';
import type { OperatorRecord } from './platform.types';
import { PlatformController } from './platform.controller';

/** A tiny in-memory stand-in for the operators collection. */
function operatorsCollection(seed: OperatorRecord[]) {
  const rows = seed.map((row) => ({ ...row, _id: row._id ?? new ObjectId() }));
  const match = (query: Record<string, unknown>) =>
    rows.find((row) =>
      Object.entries(query).every(([key, value]) =>
        key === '_id'
          ? String(row._id) === String(value)
          : (row as Record<string, unknown>)[key] === value,
      ),
    );
  return {
    rows,
    findOne: jest.fn((query: Record<string, unknown>) =>
      Promise.resolve(match(query) ?? null),
    ),
    updateOne: jest.fn(() => Promise.resolve({})),
    insertOne: jest.fn((row: OperatorRecord) => {
      const _id = new ObjectId();
      rows.push({ ...row, _id });
      return Promise.resolve({ insertedId: _id });
    }),
    find: jest.fn(() => ({
      sort: () => ({ toArray: () => Promise.resolve(rows) }),
    })),
    countDocuments: jest.fn(() => Promise.resolve(1)),
    findOneAndUpdate: jest.fn(
      (
        query: Record<string, unknown>,
        update: { $set: Partial<OperatorRecord>; $inc?: { sessionVersion: number } },
      ) => {
        const row = match(query);
        if (row) Object.assign(row, update.$set);
        if (row && update.$inc) row.sessionVersion = (row.sessionVersion ?? 0) + update.$inc.sessionVersion;
        return Promise.resolve(row ?? null);
      },
    ),
  };
}

describe('platform operator access', () => {
  let app: INestApplication;
  const owner = {
    email: 'owner@chuflow.com',
    passwordHash: bcrypt.hashSync('owner-password-123', 4),
    role: 'owner' as const,
    isActive: true,
    createdAt: new Date(),
  };
  const support = {
    email: 'support@chuflow.com',
    passwordHash: bcrypt.hashSync('support-password-1', 4),
    role: 'support' as const,
    isActive: true,
    createdAt: new Date(),
  };
  const operators = operatorsCollection([owner, support]);
  const audit = { record: jest.fn(), list: jest.fn(() => Promise.resolve([])) };
  const workspaces = {
    list: jest.fn(() => Promise.resolve([])),
    get: jest.fn(),
    detail: jest.fn(),
    provision: jest.fn(() =>
      Promise.resolve({ workspace: { id: 'new-church' } }),
    ),
  };
  const subscriptions = {
    overview: jest.fn(() => Promise.resolve({})),
    listPlans: jest.fn(() => Promise.resolve([])),
  };

  async function build(enabled: boolean) {
    const control = { enabled, operators } as unknown as ControlDatabase;
    const config = new ConfigService({
      platformEnabled: enabled,
      platformJwtSecret: 'platform-test-secret-at-least-32-chars',
    });
    const module = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [
        { provide: ControlDatabase, useValue: control },
        { provide: ConfigService, useValue: config },
        OperatorsService,
        { provide: PlatformAuditService, useValue: audit },
        { provide: PlatformWorkspacesService, useValue: workspaces },
        { provide: PlatformSubscriptionsService, useValue: subscriptions },
      ],
    }).compile();
    const built = module.createNestApplication();
    built.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await built.init();
    return built;
  }

  beforeAll(async () => {
    app = await build(true);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Server;
  const login = (email: string, password: string) =>
    request(server())
      .post('/platform/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email, password });

  it('signs operators in with their own credentials and rejects the rest', async () => {
    await login('owner@chuflow.com', 'wrong-password-1').expect(401);
    await request(server()).get('/platform/workspaces').expect(401);
    await request(server())
      .get('/platform/workspaces')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
    const response = await login(
      'owner@chuflow.com',
      'owner-password-123',
    ).expect(200);
    const body = response.body as { accessToken: string };
    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      operator: { email: 'owner@chuflow.com', role: 'owner' },
    });
    const me = await request(server())
      .get('/platform/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      kind: 'operator',
      email: 'owner@chuflow.com',
      role: 'owner',
    });
  });

  it('limits what each operator role can do', async () => {
    const signedIn = await login(
      'support@chuflow.com',
      'support-password-1',
    ).expect(200);
    const body = signedIn.body as { accessToken: string };
    const auth = `Bearer ${body.accessToken}`;
    await request(server())
      .get('/platform/workspaces')
      .set('Authorization', auth)
      .expect(200);
    await request(server())
      .get('/platform/operators')
      .set('Authorization', auth)
      .expect(403);
    await request(server())
      .post('/platform/workspaces/test-church/archive')
      .set('Authorization', auth)
      .send({ reason: 'closing down' })
      .expect(403);
    await request(server())
      .post('/platform/workspaces')
      .set('Authorization', auth)
      .send({ handle: 'bad handle!', name: 'x', adminEmail: 'nope' })
      .expect(400);
    await request(server())
      .post('/platform/workspaces')
      .set('Authorization', auth)
      .send({
        handle: 'new-church',
        name: 'New Church',
        adminEmail: 'pastor@new.church',
      })
      .expect(201);
    expect(workspaces.provision).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'support@chuflow.com' }),
      expect.objectContaining({ handle: 'new-church' }),
    );
  });

  it('rejects a church session token on the operator API', async () => {
    await request(server())
      .get('/platform/workspaces')
      .set(
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid',
      )
      .expect(401);
  });

  it('revokes an operator session when its password is changed', async () => {
    const session = await login('owner@chuflow.com', 'owner-password-123').expect(200);
    const token = (session.body as { accessToken: string }).accessToken;
    const id = String(operators.rows.find((row) => row.email === owner.email)?._id);
    await request(server())
      .patch('/platform/operators/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send({ password: 'rotated-owner-password-456' })
      .expect(200);
    await request(server())
      .get('/platform/auth/me')
      .set('Authorization', 'Bearer ' + token)
      .expect(401);
    await login('owner@chuflow.com', 'rotated-owner-password-456').expect(200);
  });

  it('does not exist where the control plane is switched off', async () => {
    const disabled = await build(false);
    await request(disabled.getHttpServer() as Server)
      .post('/platform/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'owner@chuflow.com', password: 'owner-password-123' })
      .expect(404);
    await request(disabled.getHttpServer() as Server)
      .get('/platform/workspaces')
      .expect(404);
    await disabled.close();
  });
});
