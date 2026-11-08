import { ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ALLOW_TEMPORARY_PASSWORD = 'allowTemporaryPassword';
export const AllowTemporaryPassword = () => SetMetadata(ALLOW_TEMPORARY_PASSWORD, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown, context: ExecutionContext, status?: unknown): TUser {
    const authenticated = super.handleRequest<TUser>(err, user, info, context, status);
    if ((authenticated as { passwordChangeRequired?: boolean }).passwordChangeRequired &&
        !this.reflector.get<boolean>(ALLOW_TEMPORARY_PASSWORD, context.getHandler())) {
      throw new ForbiddenException({ code: 'password_change_required', message: 'Change your temporary password to continue.' });
    }
    return authenticated;
  }
}
