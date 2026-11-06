import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PermissionsService } from './permissions.service';
describe('live permission session resolution', () => {
  it('reloads grants on every authenticated request so revocation does not wait for JWT expiry', async () => {
    const user = {
      _id: '600000000000000000000001',
      role: 'follow_up',
      email: 'user@example.com',
      isActive: true,
    };
    const users = { findById: jest.fn(() => Promise.resolve(user)) };
    const permissions = {
      resolve: jest
        .fn()
        .mockResolvedValueOnce({ additionalPermissions: ['members.view'] })
        .mockResolvedValueOnce({ additionalPermissions: [] }),
    };
    const strategy = new JwtStrategy(
      new ConfigService({ jwtSecret: 'test-only-secret' }),
      users as unknown as UsersService,
      permissions as unknown as PermissionsService,
    );
    expect(
      (await strategy.validate({ sub: String(user._id) }))
        .additionalPermissions,
    ).toEqual(['members.view']);
    expect(
      (await strategy.validate({ sub: String(user._id) }))
        .additionalPermissions,
    ).toEqual([]);
    expect(users.findById).toHaveBeenCalledTimes(2);
    expect(permissions.resolve).toHaveBeenCalledTimes(2);
  });
  it('an inactive account cannot retain delegated permissions', async () => {
    const users = {
      findById: jest.fn(() => Promise.resolve({ isActive: false })),
    };
    const permissions = { resolve: jest.fn() };
    const strategy = new JwtStrategy(
      new ConfigService({ jwtSecret: 'test-only-secret' }),
      users as unknown as UsersService,
      permissions as unknown as PermissionsService,
    );
    await expect(
      strategy.validate({ sub: '600000000000000000000001' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(permissions.resolve).not.toHaveBeenCalled();
  });
});
