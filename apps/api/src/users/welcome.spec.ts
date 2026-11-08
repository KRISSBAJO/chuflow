/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

const actor: AuthUser = {
  sub: 'admin',
  email: 'admin@example.com',
  role: 'super_admin',
};
describe('account welcome emails', () => {
  function fixture(active = true) {
    const target = {
      _id: 'target',
      firstName: 'A',
      lastName: 'Person',
      email: 'person@example.com',
      role: 'district_admin',
      district: 'Atlanta',
      oversightRegion: 'Americas',
      isActive: active,
    };
    const model = {
      findById: jest.fn().mockReturnValue({
        select: () => ({ lean: () => Promise.resolve(target) }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const mail = {
      sendWelcomeEmail: jest
        .fn()
        .mockResolvedValue({ delivered: true, messageId: 'email-1' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(
      model as never,
      {} as never,
      new ConfigService({ webUrl: 'https://chuflow.com' }),
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      mail as never,
    );
    return { service, model, mail, audit };
  }
  it('stores only a hash of the expiring setup token and audits no secret', async () => {
    const f = fixture();
    const result = await f.service.sendWelcome(actor, 'target');
    const url = (
      f.mail.sendWelcomeEmail.mock.calls as unknown as string[][]
    )[0][4];
    const token = new URL(url).searchParams.get('token')!;
    const set = (
      f.model.updateOne.mock.calls as unknown as [
        unknown,
        { $set: { passwordResetToken: string; passwordResetExpiresAt: Date } },
      ][]
    )[0][1].$set as {
      passwordResetToken: string;
      passwordResetExpiresAt: Date;
    };
    expect(set.passwordResetToken).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(set.passwordResetToken).not.toBe(token);
    expect(set.passwordResetExpiresAt.getTime() - Date.now()).toBeGreaterThan(
      86300000,
    );
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(f.audit.record.mock.calls)).not.toContain(token);
    expect(result).toEqual({ status: 'accepted', messageId: 'email-1' });
  });
  it('reports provider failure without throwing or returning a credential', async () => {
    const f = fixture();
    f.mail.sendWelcomeEmail.mockRejectedValue(new Error('provider secret'));
    expect(await f.service.sendWelcome(actor, 'target')).toEqual({
      status: 'failed',
      messageId: null,
    });
  });
  it('does not send invitations for disabled accounts', async () => {
    const f = fixture(false);
    expect(await f.service.sendWelcome(actor, 'target')).toEqual({
      status: 'inactive',
    });
    expect(f.mail.sendWelcomeEmail).not.toHaveBeenCalled();
  });
  it('rejects managers who cannot assign the target role before creating a token', async () => {
    const f = fixture();
    await expect(
      f.service.sendWelcome({ ...actor, role: 'branch_admin' }, 'target'),
    ).rejects.toThrow(ForbiddenException);
    expect(f.model.updateOne).not.toHaveBeenCalled();
  });
  it('prevents concurrent or repeated sends during the cooldown', async () => {
    const f = fixture();
    f.model.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await f.service.sendWelcome(actor, 'target')).toEqual({
      status: 'recently_requested',
    });
    expect(f.mail.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});

describe('public password reset responses', () => {
  it('consumes the matching unexpired token atomically, rejecting a second use', async () => {
    const model = {
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValueOnce({ _id: 'user' })
        .mockResolvedValueOnce(null),
    };
    const service = new UsersService(
      model as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.updatePassword('user', 'NewPassword123!', 'token-hash');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'user',
        passwordResetToken: 'token-hash',
        passwordResetExpiresAt: { $gt: expect.any(Date) },
        isActive: true,
      },
      {
        $set: { password: expect.any(String) },
        $unset: {
          passwordResetToken: 1,
          passwordResetExpiresAt: 1,
          passwordChangeRequired: 1,
        },
      },
      { new: true },
    );
    await expect(
      service.updatePassword('user', 'AnotherPassword123!', 'token-hash'),
    ).rejects.toThrow('Reset token is invalid or has expired');
  });
  it.each(['missing', 'accepted', 'not configured', 'failed'])(
    'does not expose credentials or account existence: %s',
    async (scenario) => {
      const users = {
        findByEmail: jest
          .fn()
          .mockResolvedValue(
            scenario === 'missing'
              ? null
              : { id: 'user', email: 'user@example.com' },
          ),
        setPasswordResetToken: jest.fn(),
      };
      const mail = {
        sendPasswordResetEmail: jest.fn().mockImplementation(() =>
          scenario === 'failed'
            ? Promise.reject(new Error('provider failed'))
            : Promise.resolve({
                delivered: scenario === 'accepted',
                previewUrl: 'SECRET',
              }),
        ),
      };
      const service = new AuthService(
        users as never,
        {} as never,
        new ConfigService({ webUrl: 'https://chuflow.com' }),
        mail as never,
        {} as never,
      );
      expect(
        await service.forgotPassword({ email: 'user@example.com' }),
      ).toEqual({
        message:
          'If an account exists for that email, password reset instructions have been prepared.',
      });
    },
  );
});
