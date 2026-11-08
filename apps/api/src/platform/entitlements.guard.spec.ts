import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { Public } from '../common/decorators/public.decorator';
import { EntitlementsGuard, SubscriptionExempt } from './entitlements.guard';
import { EntitlementsService } from './entitlements.service';
import type { EntitlementSnapshot } from './platform.types';
import { RequiresFeature } from './requires-feature.decorator';
import { legacySnapshot } from './subscription-rules';

@Controller('members')
class MembersStub {
  @Get() list() {
    return { ok: true };
  }
  @Post() create() {
    return { ok: true };
  }
}

@Controller('attendance')
class AttendanceStub {
  @Post() record() {
    return { ok: true };
  }
}

@RequiresFeature('kids')
@Controller('children')
class ChildrenStub {
  @Get() list() {
    return { ok: true };
  }
}

@Controller('auth')
class AuthStub {
  @Get('me') me() {
    return { ok: true };
  }
  @Public()
  @Post('login')
  login() {
    return { ok: true };
  }
}

@Controller('intake-templates')
class PublicIntakeStub {
  @Public()
  @Get('public/form')
  form() {
    return { ok: true };
  }

  @Public()
  @Post('public/form')
  submit() {
    return { ok: true };
  }
}

@Controller('workspace-requests')
class WorkspaceRequestsStub {
  @Public()
  @SubscriptionExempt()
  @Post()
  signup() {
    return { ok: true };
  }
}

describe('EntitlementsGuard', () => {
  let app: INestApplication;
  let snapshot: EntitlementSnapshot;
  const service = { snapshot: jest.fn(() => Promise.resolve(snapshot)) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MembersStub, AttendanceStub, ChildrenStub, AuthStub, PublicIntakeStub, WorkspaceRequestsStub],
      providers: [
        { provide: EntitlementsService, useValue: service },
        { provide: APP_GUARD, useClass: EntitlementsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer() as Server;
  const enforced = (
    patch: Partial<EntitlementSnapshot>,
  ): EntitlementSnapshot => ({
    ...legacySnapshot('test-church'),
    enforced: true,
    ...patch,
  });

  it('does nothing without a control plane', async () => {
    snapshot = legacySnapshot('test-church');
    await request(server()).post('/members').expect(201);
    await request(server()).get('/children').expect(200);
  });

  it('answers 402 for features outside the plan', async () => {
    snapshot = enforced({ features: ['members'] });
    await request(server()).get('/members').expect(200);
    const response = await request(server()).get('/children').expect(402);
    expect(response.body).toMatchObject({
      code: 'feature_locked',
      feature: 'kids',
    });
  });

  it('keeps reading, signing in and phone attendance working while read-only', async () => {
    snapshot = enforced({
      access: 'read_only',
      reason: 'payment_overdue',
      graceEndsAt: '2026-11-01T00:00:00.000Z',
    });
    await request(server()).get('/members').expect(200);
    await request(server()).get('/auth/me').expect(200);
    await request(server()).post('/auth/login').expect(201);
    await request(server()).post('/attendance').expect(201);
    const response = await request(server()).post('/members').expect(402);
    expect(response.body).toMatchObject({
      code: 'workspace_read_only',
      reason: 'payment_overdue',
    });
  });

  it('locks everything but sign-in when suspended', async () => {
    snapshot = enforced({ access: 'locked', reason: 'suspended' });
    await request(server()).get('/auth/me').expect(200);
    const response = await request(server()).get('/members').expect(402);
    expect(response.body).toMatchObject({
      code: 'workspace_locked',
      reason: 'suspended',
    });
  });

  it('applies subscription locks to public forms and keeps platform signup open', async () => {
    snapshot = enforced({ access: 'locked', reason: 'suspended' });
    await request(server()).get('/intake-templates/public/form').expect(402);
    await request(server()).post('/intake-templates/public/form').expect(402);
    await request(server()).post('/workspace-requests').expect(201);
    snapshot = enforced({ access: 'read_only', reason: 'payment_overdue' });
    await request(server()).get('/intake-templates/public/form').expect(200);
    await request(server()).post('/intake-templates/public/form').expect(402);
    snapshot = legacySnapshot('test-church');
    await request(server()).post('/intake-templates/public/form').expect(201);
  });
});
