import { Controller, Get } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionSubject } from '../common/permissions';
import {
  PERMISSION_ENDPOINTS,
  endpointPermission,
} from '../common/permission-endpoints';
import { MembersController } from '../members/members.controller';
import { GuestsController } from '../guests/guests.controller';
import { FinanceController } from '../finance/finance.controller';
import { AttendanceController } from '../attendance/attendance.controller';
import { IntakeTemplatesController } from '../intake-templates/intake-templates.controller';
import { PermissionsController } from './permissions.controller';
@Controller('users')
@Roles('super_admin')
class AdminController {
  @Get() list() {}
}
@Controller('members')
@Roles('branch_admin')
class MemberEndpoints {
  @Get() list() {}
  @Get('new') create() {}
  @Get('delete') remove() {}
}
function allowed(controller: object, handler: string, user: PermissionSubject) {
  const type = controller as { prototype: Record<string, unknown> };
  return new RolesGuard(new Reflector()).canActivate({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getClass: () => controller,
    getHandler: () => type.prototype[handler],
  } as unknown as ExecutionContext);
}
describe('feature grants only unlock explicit operations', () => {
  it('allows delegated viewing without creating or administering users', () => {
    const user = {
      role: 'children_worker',
      additionalPermissions: ['members.view'],
    };
    expect(allowed(MemberEndpoints, 'list', user)).toBe(true);
    expect(allowed(MemberEndpoints, 'create', user)).toBe(false);
    expect(allowed(MemberEndpoints, 'remove', user)).toBe(false);
    expect(allowed(AdminController, 'list', user)).toBe(false);
    expect(allowed(PermissionsController, 'targets', user)).toBe(false);
  });
  it('preserves role defaults and includes create prerequisites', () => {
    expect(allowed(MemberEndpoints, 'create', { role: 'branch_admin' })).toBe(
      true,
    );
    const user = { role: 'usher', additionalPermissions: ['members.create'] };
    expect(allowed(MemberEndpoints, 'list', user)).toBe(true);
    expect(allowed(MemberEndpoints, 'create', user)).toBe(true);
    expect(allowed(MemberEndpoints, 'remove', user)).toBe(false);
  });
  it('endpoint allow-list names match the real controller handlers', () => {
    for (const [name, controller] of Object.entries({
      members: MembersController,
      guests: GuestsController,
      finance: FinanceController,
      attendance: AttendanceController,
      'intake-templates': IntakeTemplatesController,
    })) {
      for (const method of Object.keys(PERMISSION_ENDPOINTS[name]))
        expect(
          typeof controller.prototype[
            method as keyof typeof controller.prototype
          ],
        ).toBe('function');
    }
    expect(endpointPermission('users', 'update')).toBeUndefined();
    expect(endpointPermission('finance', 'createAccount')).toBeUndefined();
    expect(endpointPermission('permissions', 'grant')).toBeUndefined();
  });
});
