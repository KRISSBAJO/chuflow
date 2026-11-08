/* eslint-disable @typescript-eslint/no-require-imports */
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { workspaceWebLink } from '../workspaces/workspace-boundary';

const gateway = require('../../scripts/workspace-gateway.cjs') as {
  workerEnvironment: (
    env: Record<string, string | undefined>,
    entry?: Record<string, string>,
  ) => Record<string, string | undefined>;
};

function authService(
  config: Record<string, unknown>,
  users: Partial<UsersService>,
  mail = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue({ delivered: true }),
  },
) {
  return {
    service: new AuthService(
      users as never,
      { signAsync: jest.fn().mockResolvedValue('token') } as never,
      new ConfigService(config),
      mail as never,
      { resolve: jest.fn().mockResolvedValue({}) } as never,
    ),
    mail,
  };
}

describe('tenant-aware sign-in links', () => {
  it('keeps plain links for the primary workspace and scopes them for a provisioned one', () => {
    const primary = new ConfigService({ webUrl: 'https://chuflow.com/' });
    expect(workspaceWebLink(primary, '/reset-password', { token: 'abc' })).toBe(
      'https://chuflow.com/reset-password?token=abc',
    );
    const church = new ConfigService({
      webUrl: 'https://chuflow.com',
      workspaceId: 'grace-chapel',
      workspaceName: 'Grace Chapel',
    });
    expect(workspaceWebLink(church, '/reset-password', { token: 'abc' })).toBe(
      'https://chuflow.com/reset-password?workspace=grace-chapel&token=abc',
    );
    expect(workspaceWebLink(church, '/login')).toBe(
      'https://chuflow.com/login?workspace=grace-chapel',
    );
  });

  it('emails a provisioned workspace a reset link that names the workspace', async () => {
    const users = {
      findByEmail: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'admin@grace.church' }),
      setPasswordResetToken: jest.fn().mockResolvedValue(undefined),
    };
    const { service, mail } = authService(
      { webUrl: 'https://chuflow.com', workspaceId: 'grace-chapel' },
      users,
    );
    await service.forgotPassword({ email: 'admin@grace.church' });
    const [, resetUrl] = mail.sendPasswordResetEmail.mock.calls[0] as [
      string,
      string,
    ];
    const url = new URL(resetUrl);
    expect(url.pathname).toBe('/reset-password');
    expect(url.searchParams.get('workspace')).toBe('grace-chapel');
    expect(url.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('names the workspace publicly and flags the generated first password in sessions', async () => {
    const users = {
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue({
        _id: 'u1',
        email: 'admin@grace.church',
        role: 'super_admin',
        isActive: true,
        passwordChangeRequired: true,
      }),
    };
    const { service } = authService(
      { workspaceId: 'grace-chapel', workspaceName: 'Grace Chapel' },
      users,
    );
    expect(service.workspaceInfo()).toEqual({
      id: 'grace-chapel',
      name: 'Grace Chapel',
      primary: false,
    });
    const session = await service.startWorkspaceSession('u1');
    expect(session.user.passwordChangeRequired).toBe(true);
    expect(session.user.workspace).toEqual({
      id: 'grace-chapel',
      name: 'Grace Chapel',
    });
    expect(await service.me('u1')).toMatchObject({
      passwordChangeRequired: true,
    });
  });
});

describe('first admin seeding', () => {
  function seed(config: Record<string, unknown>) {
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new UsersService(
      model as never,
      {} as never,
      new ConfigService({
        adminEmail: 'Admin@Church.org',
        adminPassword: 'generated-password-20',
        ...config,
      }),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, model };
  }

  it('makes a provisioned workspace admin replace the generated password, but not the primary admin', async () => {
    const church = seed({ workspaceId: 'grace-chapel' });
    await church.service.onModuleInit();
    expect(church.model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@church.org',
        role: 'super_admin',
        passwordChangeRequired: true,
      }),
    );
    const primary = seed({});
    await primary.service.onModuleInit();
    expect(
      (primary.model.create.mock.calls[0] as [Record<string, unknown>])[0],
    ).not.toHaveProperty('passwordChangeRequired');
  });
});

describe('temporary workspace sessions', () => {
  it('rejects the temporary token after the admin changes their password', async () => {
    const admin = { email: 'admin@grace.church', role: 'super_admin', isActive: true, passwordChangeRequired: true };
    const strategy = new JwtStrategy(
      new ConfigService({ workspaceId: 'grace-chapel' }),
      { findById: jest.fn().mockImplementation(() => Promise.resolve(admin)) } as never,
      { resolve: jest.fn().mockResolvedValue({}) } as never,
    );
    const claims = { sub: 'admin', workspaceId: 'grace-chapel' };
    await expect(strategy.validate(claims)).rejects.toMatchObject({ status: 401 });
    await expect(strategy.validate({ ...claims, temporaryPassword: true })).resolves.toMatchObject({ passwordChangeRequired: true });
    admin.passwordChangeRequired = false;
    await expect(strategy.validate({ ...claims, temporaryPassword: true })).rejects.toMatchObject({ status: 401 });
    await expect(strategy.validate(claims)).resolves.toMatchObject({ passwordChangeRequired: false });
  });
});

describe('gateway worker environment', () => {
  it('passes the platform mail settings to workspace workers so recovery mail is sent', () => {
    const env = {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/church_mgt',
      JWT_SECRET: 'primary',
      MAIL_PROVIDER: 'relykit',
      RELYKIT_API_KEY: 'key',
      MAIL_FROM: 'no-reply@chuflow.com',
      APP_NAME: 'ChuFlow',
      WEB_URL: 'https://chuflow.com',
    };
    const worker = gateway.workerEnvironment(env, {
      id: 'grace-chapel',
      name: 'Grace Chapel',
      mongodbUri: env.MONGODB_URI,
      databaseName: 'chuflow_grace_chapel',
      jwtSecret: 'x'.repeat(64),
      adminEmail: 'admin@grace.church',
      adminPassword: 'generated-password-20',
    });
    expect(worker).toMatchObject({
      WORKSPACE_ID: 'grace-chapel',
      MAIL_PROVIDER: 'relykit',
      RELYKIT_API_KEY: 'key',
      MAIL_FROM: 'no-reply@chuflow.com',
      APP_NAME: 'ChuFlow',
      WEB_URL: 'https://chuflow.com',
    });
    expect(worker.MAIL_PORT).toBeUndefined();
    expect(worker.AUTH_COOKIE_NAME).toBe('cms_workspace_grace-chapel');
  });
});
