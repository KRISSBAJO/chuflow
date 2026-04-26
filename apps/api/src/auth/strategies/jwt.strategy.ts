import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request & { cookies?: Record<string, string> }) => {
          const cookieName = configService.get<string>('cookieName') ?? 'cms_access_token';
          return request?.cookies?.[cookieName] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwtSecret') ?? 'super-secret-change-me',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.usersService.findById(payload.sub).catch(() => null);

    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Authentication failed');
    }

    return {
      sub: user._id ? String(user._id) : payload.sub,
      email: user.email,
      role: user.role,
      oversightRegion: user.oversightRegion,
      district: user.district,
      branchId: user.branchId ? String(user.branchId) : undefined,
    };
  }
}
