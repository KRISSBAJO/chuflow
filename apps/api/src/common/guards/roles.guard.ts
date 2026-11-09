import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { childrenApiAllowed } from '../children-access';
import { YOUTH_ROLES, type AppRole } from '../constants/roles.constants';
import {
  additionalPermissionKeys,
  hasAdditionalPermission,
} from '../permissions';
import {
  endpointPermission,
  isPermissionLookup,
} from '../permission-endpoints';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; additionalPermissions?: string[] };
    }>();
    const controller = this.reflector.get<unknown>(
      PATH_METADATA,
      context.getClass(),
    );
    const handler = context.getHandler().name;
    const role = request.user?.role as AppRole | undefined;
    const endpoint = this.reflector.get(PATH_METADATA, context.getHandler());
    if (role === 'youth_participant') {
      return controller === 'youth-participant' ||
        (controller === 'auth' && ['me', 'logout', 'change-password', 'workspaces', 'workspaces/:workspaceId/handoff'].includes(String(endpoint)));
    }
    if (role && YOUTH_ROLES.includes(role) && controller !== 'youth' &&
        !(controller === 'auth' && ['me', 'logout', 'change-password', 'workspaces', 'workspaces/:workspaceId/handoff', 'browser-handoff'].includes(String(endpoint)))) {
      return false;
    }
    const permission = endpointPermission(controller, handler);
    const extra =
      (!!permission && hasAdditionalPermission(request.user, permission)) ||
      isPermissionLookup(
        controller,
        handler,
        additionalPermissionKeys(request.user),
      );
    if (
      !childrenApiAllowed(
        request.user?.role,
        controller,
        endpoint,
      ) &&
      !extra
    )
      return false;
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    return (!!request.user?.role && roles.includes(request.user.role)) || extra;
  }
}
