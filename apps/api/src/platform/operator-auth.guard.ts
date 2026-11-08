import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OperatorsService, type OperatorClaims } from './operators.service';
import type { OperatorRole } from './platform.types';

export const OPERATOR_ROLES_KEY = 'operatorRoles';
export const OperatorRoles = (...roles: OperatorRole[]) =>
  SetMetadata(OPERATOR_ROLES_KEY, roles);

export const CurrentOperator = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    return context.switchToHttp().getRequest<{ operator?: OperatorClaims }>()
      .operator;
  },
);

/** Everything under /platform is operator-only and only exists where the control plane runs. */
@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly operators: OperatorsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.operators.enabled) throw new NotFoundException();
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      operator?: OperatorClaims;
    }>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Operator sign-in required.');
    request.operator = await this.operators.verify(token);
    const roles = this.reflector.getAllAndOverride<OperatorRole[] | undefined>(
      OPERATOR_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(request.operator.role)) {
      throw new ForbiddenException('Your operator role cannot do this.');
    }
    return true;
  }
}
