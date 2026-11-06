import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceController } from '../attendance/attendance.controller';
import { FinanceService } from '../finance/finance.service';
import { FinanceController } from '../finance/finance.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChurchReportingController } from './church-reporting.controller';
import { ChurchReportingService } from './church-reporting.service';

const churchA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const churchB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ownChurch = {
  _id: churchA,
  name: 'Local church A',
  district: 'District A',
  oversightRegion: 'Region A',
  status: 'active',
};
const worker: AuthUser = {
  sub: 'cccccccccccccccccccccccc',
  email: 'worker@example.test',
  role: 'resident_pastor',
  branchId: churchA,
};
function makeScope(branch: Record<string, unknown> | null = ownChurch) {
  const branchModel = {
    findOne: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(branch),
    })),
  };
  return {
    scope: new AccessScopeService(
      branchModel as never,
      {} as never,
      {} as never,
    ),
    branchModel,
  };
}

describe('Local church reporting boundaries', () => {
  it.each([
    'super_admin',
    'national_admin',
    'national_pastor',
    'district_admin',
    'district_pastor',
    'follow_up',
    'children_worker',
    'children_supervisor',
  ])(
    'rejects %s entry even with a matching branch assignment',
    async (role) => {
      const { scope, branchModel } = makeScope();
      await expect(
        scope.localReportingBranch({ ...worker, role }, churchA),
      ).rejects.toThrow(ForbiddenException);
      expect(branchModel.findOne).not.toHaveBeenCalled();
    },
  );
  it.each(['branch_admin', 'resident_pastor', 'associate_pastor', 'usher'])(
    'allows assigned local %s',
    async (role) => {
      await expect(
        makeScope().scope.localReportingBranch({ ...worker, role }, churchA),
      ).resolves.toMatchObject({ _id: churchA });
    },
  );
  it('rejects a different church even for a pastor with oversight', async () => {
    await expect(
      makeScope().scope.localReportingBranch(worker, churchB),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rejects inactive or missing churches and missing assignments', async () => {
    for (const branch of [null, { ...ownChurch, status: 'inactive' }]) {
      await expect(
        makeScope(branch).scope.localReportingBranch(worker, churchA),
      ).rejects.toThrow(ForbiddenException);
    }
    await expect(
      makeScope().scope.localReportingBranch(
        { ...worker, branchId: undefined },
        churchA,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      makeScope().scope.localReportingBranch(worker, 'bad-id'),
    ).rejects.toThrow(ForbiddenException);
  });
  it('keeps district visibility restricted to both district and oversight region', async () => {
    const { scope } = makeScope();
    const district = {
      ...worker,
      role: 'district_admin',
      district: 'District A',
      oversightRegion: 'Region A',
    };
    await expect(scope.getBranchDocumentQuery(district)).resolves.toEqual({
      district: 'District A',
      oversightRegion: 'Region A',
    });
    await expect(
      scope.getBranchDocumentQuery({ ...district, district: undefined }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      scope.getBranchDocumentQuery({ ...district, oversightRegion: undefined }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      scope.ensureBranchAccess(
        { ...district, oversightRegion: 'Region B' },
        churchA,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('Authenticated reporting routes', () => {
  let app: INestApplication;
  const attendance = {
    create: jest.fn().mockResolvedValue({ _id: 'entry', branchId: churchA }),
  };
  const finance = {
    createOfferingEntry: jest.fn().mockResolvedValue({ _id: 'entry' }),
    createExpenseEntry: jest.fn().mockResolvedValue({ _id: 'entry' }),
  };
  const offering = {
    serviceDate: '2026-11-01T10:00:00Z',
    serviceTypeId: churchB,
    offeringTypeId: churchB,
    amount: 20,
  };
  const summary = {
    branchId: churchA,
    serviceDate: '2026-11-01T10:00:00Z',
    entryMode: 'summary',
    personType: 'summary',
    adultsCount: 10,
    childrenCount: 4,
  };
  beforeAll(async () => {
    const auth = {
      canActivate(context: ExecutionContext) {
        const req = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string>; user: AuthUser }>();
        if (!req.headers['x-test-role']) throw new UnauthorizedException();
        req.user = {
          ...worker,
          role: req.headers['x-test-role'],
          branchId: req.headers['x-test-branch'] || churchA,
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [
        ChurchReportingController,
        AttendanceController,
        FinanceController,
      ],
      providers: [
        ChurchReportingService,
        { provide: AccessScopeService, useValue: makeScope().scope },
        { provide: AttendanceService, useValue: attendance },
        { provide: FinanceService, useValue: finance },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(auth)
      .compile();
    app = module.createNestApplication();
    app.useGlobalGuards(auth, new RolesGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());
  it('requires sign-in for both reading the form context and posting', async () => {
    await request(app.getHttpServer())
      .get(`/church-reporting/${churchA}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/attendance`)
      .send(summary)
      .expect(401);
    expect(attendance.create).not.toHaveBeenCalled();
  });
  it('does not reveal a different church or accept its attendance', async () => {
    await request(app.getHttpServer())
      .get(`/church-reporting/${churchB}`)
      .set('x-test-role', 'resident_pastor')
      .expect(403);
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchB}/attendance`)
      .set('x-test-role', 'resident_pastor')
      .send({ ...summary, branchId: churchB })
      .expect(403);
    expect(attendance.create).not.toHaveBeenCalled();
  });
  it('rejects a swapped church in the request body before any write', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/attendance`)
      .set('x-test-role', 'usher')
      .send({ ...summary, branchId: churchB })
      .expect(403);
    expect(attendance.create).not.toHaveBeenCalled();
  });
  it('keeps district administrators read-only on the shared recording forms', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/offerings`)
      .set('x-test-role', 'district_admin')
      .send(offering)
      .expect(403);
    expect(finance.createOfferingEntry).not.toHaveBeenCalled();
  });
  it('records valid local attendance through the existing audited service', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/attendance`)
      .set('x-test-role', 'usher')
      .send(summary)
      .expect(201);
    expect(attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: churchA, adultsCount: 10 }),
      expect.objectContaining({ role: 'usher', branchId: churchA }),
    );
  });
  it('records local offerings and rejects a different-church offering link', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/offerings`)
      .set('x-test-role', 'usher')
      .send(offering)
      .expect(201);
    expect(finance.createOfferingEntry).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchB}/offerings`)
      .set('x-test-role', 'usher')
      .send(offering)
      .expect(403);
    expect(finance.createOfferingEntry).toHaveBeenCalledTimes(1);
  });
  it('does not let an usher create expenses through a finance link', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/expenses`)
      .set('x-test-role', 'usher')
      .send({})
      .expect(403);
    expect(finance.createExpenseEntry).not.toHaveBeenCalled();
  });
  it('rejects simple-form attendance submissions before any write', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/attendance`)
      .set('x-test-role', 'usher')
      .type('form')
      .send(summary)
      .expect(415);
    await request(app.getHttpServer())
      .post('/attendance')
      .set('x-test-role', 'usher')
      .type('form')
      .send(summary)
      .expect(415);
    expect(attendance.create).not.toHaveBeenCalled();
  });
  it('rejects simple-form finance submissions before any write', async () => {
    await request(app.getHttpServer())
      .post(`/church-reporting/${churchA}/offerings`)
      .set('x-test-role', 'usher')
      .type('form')
      .send(offering)
      .expect(415);
    await request(app.getHttpServer())
      .post('/finance/offerings')
      .set('x-test-role', 'usher')
      .type('form')
      .send(offering)
      .expect(415);
    expect(finance.createOfferingEntry).not.toHaveBeenCalled();
  });
  it('cannot bypass local-only entry through the normal attendance endpoint', async () => {
    await request(app.getHttpServer())
      .post('/attendance')
      .set('x-test-role', 'district_admin')
      .send(summary)
      .expect(403);
    await request(app.getHttpServer())
      .post('/attendance')
      .set('x-test-role', 'resident_pastor')
      .send({ ...summary, branchId: churchB })
      .expect(403);
    expect(attendance.create).not.toHaveBeenCalled();
  });
  it('keeps normal finance expense entry local while oversight retains review routes', async () => {
    const expense = {
      branchId: churchB,
      expenseDate: '2026-11-01',
      expenseCategoryId: churchB,
      accountId: churchB,
      amount: 20,
      description: 'Local expense',
    };
    await request(app.getHttpServer())
      .post('/finance/expenses')
      .set('x-test-role', 'district_admin')
      .send(expense)
      .expect(403);
    await request(app.getHttpServer())
      .post('/finance/expenses')
      .set('x-test-role', 'resident_pastor')
      .send(expense)
      .expect(403);
    expect(finance.createExpenseEntry).not.toHaveBeenCalled();
  });
});
