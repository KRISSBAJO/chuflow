import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { childrenApiAllowed } from '../children-access';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    if (
      !childrenApiAllowed(
        request.user?.role,
        this.reflector.get(PATH_METADATA, context.getClass()),
        this.reflector.get(PATH_METADATA, context.getHandler()),
      )
    )
      return false;
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    return !!request.user?.role && roles.includes(request.user.role);
  }
}
