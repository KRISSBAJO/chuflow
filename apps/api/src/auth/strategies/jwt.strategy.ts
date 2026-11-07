import { PermissionsService } from '../../permissions/permissions.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { FIRST_WORKSPACE_ID, getWorkspace } from '../../workspaces/workspace-boundary';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly permissions: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request & { cookies?: Record<string, string> }) => {
          const cookieName =
            configService.get<string>('cookieName') ?? 'cms_access_token';
          return request?.cookies?.[cookieName] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwtSecret') ?? 'super-secret-change-me',
    });
  }

  async validate(payload: { sub: string; workspaceId?: string }) {
    const { id } = getWorkspace(this.configService);
    const tokenWorkspace = payload.workspaceId === undefined ? FIRST_WORKSPACE_ID : payload.workspaceId;
    if (tokenWorkspace !== id) {
      throw new UnauthorizedException('Authentication failed');
    }

    const user = await this.usersService
      .findById(payload.sub)
      .catch(() => null);

    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Authentication failed');
    }

    return {
      workspaceId: id,
      sub: user._id ? String(user._id) : payload.sub,
      email: user.email,
      role: user.role,
      ...(await this.permissions.resolve(user)),
      oversightRegion: user.oversightRegion,
      district: user.district,
      branchId: user.branchId ? String(user.branchId) : undefined,
    };
  }
}
