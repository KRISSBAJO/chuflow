import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
describe('Meetings HTTP validation and uploads', () => {
  let app: INestApplication;
  let role: AuthUser['role'] = 'branch_admin';
  const service = {
    groups: jest.fn().mockResolvedValue([]),
    saveGroup: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    upload: jest.fn().mockResolvedValue({ ok: true }),
    removeFile: jest.fn().mockResolvedValue({ ok: true }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MeetingsController],
      providers: [{ provide: MeetingsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Request & { user: AuthUser },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = {
          sub: '507f1f77bcf86cd799439011',
          email: 'qa@example.test',
          role,
        };
        next();
      },
    );
    app.useGlobalGuards(new RolesGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    role = 'branch_admin';
    jest.clearAllMocks();
  });
  it('resolves the groups route before dynamic meeting IDs', async () => {
    await request(app.getHttpServer() as Server)
      .get('/meetings/groups')
      .expect(200, []);
    expect(service.groups).toHaveBeenCalled();
  });
  it('blocks non-leadership users from changing group requirements', async () => {
    role = 'follow_up';
    await request(app.getHttpServer() as Server)
      .post('/meetings/groups')
      .send({})
      .expect(403);
    expect(service.saveGroup).not.toHaveBeenCalled();
  });
  it('rejects unsafe meeting URLs before reaching the service', async () => {
    await request(app.getHttpServer() as Server)
      .post('/meetings')
      .send({
        groupId: '507f1f77bcf86cd799439012',
        title: 'Team planning',
        startsAt: '2026-11-04T12:00:00Z',
        endsAt: '2026-11-04T13:00:00Z',
        attendeeUserIds: [],
        joinUrl: 'javascript:alert(1)',
      })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('accepts multipart minutes documents into the private upload handler', async () => {
    await request(app.getHttpServer() as Server)
      .post('/meetings/507f1f77bcf86cd799439012/files')
      .attach('file', Buffer.from('%PDF-1.4 test'), 'minutes.pdf')
      .expect(201, { ok: true });
    const upload = service.upload.mock.calls[0] as unknown as [
      AuthUser,
      string,
      { buffer: Buffer; originalname: string },
    ];
    expect(upload[2].originalname).toBe('minutes.pdf');
    expect(upload[2].buffer.toString()).toBe('%PDF-1.4 test');
  });
  it('rejects uploads over 5 MB at the request boundary', async () => {
    await request(app.getHttpServer() as Server)
      .post('/meetings/507f1f77bcf86cd799439012/files')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'minutes.txt')
      .expect(413);
    expect(service.upload).not.toHaveBeenCalled();
  });
  it('requires a revision when removing a document', async () => {
    await request(app.getHttpServer() as Server)
      .delete(
        '/meetings/507f1f77bcf86cd799439012/files/507f1f77bcf86cd799439013',
      )
      .send({})
      .expect(400);
    expect(service.removeFile).not.toHaveBeenCalled();
  });
});
