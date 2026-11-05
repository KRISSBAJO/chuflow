import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { CareController } from './care.controller';
import { CareService } from './care.service';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
describe('Care HTTP and public link boundaries', () => {
  let app: INestApplication;
  let actor: AuthUser | null = null;
  const service = {
    publicInfo: jest
      .fn()
      .mockResolvedValue({ churchName: 'Test Church', kind: 'checkin' }),
    publicReply: jest.fn().mockResolvedValue({ success: true }),
    options: jest.fn().mockResolvedValue({ branches: [] }),
    savePlan: jest.fn().mockResolvedValue({}),
    change: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CareController],
      providers: [{ provide: CareService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Request & { user?: AuthUser },
        _res: Response,
        next: NextFunction,
      ) => {
        if (actor) req.user = actor;
        next();
      },
    );
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    actor = null;
    jest.clearAllMocks();
  });
  it('allows a private check-in token to resolve without a staff login', async () => {
    await request(app.getHttpServer() as Server)
      .get('/care/public/' + 'a'.repeat(64))
      .expect(200, { churchName: 'Test Church', kind: 'checkin' });
  });
  it('accepts a valid public reply without requiring staff roles', async () => {
    await request(app.getHttpServer() as Server)
      .post('/care/public/' + 'b'.repeat(64))
      .send({
        contactRequested: true,
        response: 'request_call',
        language: 'en',
      })
      .expect(201, { success: true });
  });
  it('denies anonymous access to internal care records', async () => {
    await request(app.getHttpServer() as Server)
      .get('/care/options')
      .expect(403);
    expect(service.options).not.toHaveBeenCalled();
  });
  it('does not allow a care worker to change branch automation settings', async () => {
    actor = {
      sub: '507f1f77bcf86cd799439011',
      role: 'follow_up',
      email: 'qa@example.test',
    };
    await request(app.getHttpServer() as Server)
      .patch('/care/plans/507f1f77bcf86cd799439012')
      .send({})
      .expect(403);
    expect(service.savePlan).not.toHaveBeenCalled();
  });
  it('rejects attempts to inject staff ownership into a public reply', async () => {
    await request(app.getHttpServer() as Server)
      .post('/care/public/' + 'c'.repeat(64))
      .send({
        contactRequested: true,
        response: 'well',
        language: 'en',
        ownerId: '507f1f77bcf86cd799439011',
      })
      .expect(400);
    expect(service.publicReply).not.toHaveBeenCalled();
  });
  it('rejects null booleans rather than silently bypassing preference validation', async () => {
    actor = {
      sub: '507f1f77bcf86cd799439011',
      role: 'branch_admin',
      email: 'qa@example.test',
    };
    await request(app.getHttpServer() as Server)
      .patch('/care/cases/507f1f77bcf86cd799439012')
      .send({
        operation: 'preferences',
        expectedRevision: 0,
        stopContact: null,
      })
      .expect(400);
    expect(service.change).not.toHaveBeenCalled();
  });
  it('rejects invalid response types and excessive notes', async () => {
    await request(app.getHttpServer() as Server)
      .post('/care/public/' + 'd'.repeat(64))
      .send({
        contactRequested: true,
        response: 'mark-as-attended',
        language: 'en',
        note: 'x'.repeat(2001),
      })
      .expect(400);
    expect(service.publicReply).not.toHaveBeenCalled();
  });
});
