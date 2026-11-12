import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChildrenRegistrationService } from './registration.service';
import { ChildrenQueryDto } from './children.dto';
import {
  ParentRegistrationDto,
  RegistrationReviewDto,
} from './registration.dto';
@Controller('children')
@Roles(...APP_ROLES)
export class ChildrenRegistrationController {
  constructor(private readonly service: ChildrenRegistrationService) {}
  @Get('registration-links/:branchId') status(
    @CurrentUser() u: AuthUser,
    @Param('branchId') id: string,
  ) {
    return this.service.manage(u, id, 'status');
  }
  @Post('registration-links/:branchId') rotate(
    @CurrentUser() u: AuthUser,
    @Param('branchId') id: string,
  ) {
    return this.service.manage(u, id, 'rotate');
  }
  @Post('registration-links/:branchId/disable') disable(
    @CurrentUser() u: AuthUser,
    @Param('branchId') id: string,
  ) {
    return this.service.manage(u, id, 'disable');
  }
  @Get('registrations') list(
    @CurrentUser() u: AuthUser,
    @Query() q: ChildrenQueryDto,
  ) {
    return this.service.queue(u, q);
  }
  @Get('registrations/:id') detail(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.detail(u, id);
  }
  @Post('registrations/:id/review') review(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: RegistrationReviewDto,
  ) {
    return this.service.review(u, id, d);
  }
}
@Controller('children-registration')
export class ParentRegistrationController {
  constructor(private readonly service: ChildrenRegistrationService) {}
  @Public() @Get('nashville') @Header('Cache-Control', 'no-store')
  nashville() { return this.service.nashvillePage(); }
  @Public() @Get() info(@Headers('x-children-registration') token: string) {
    return this.service.publicInfo(token);
  }
  @Public() @Post() submit(
    @Headers('x-children-registration') token: string,
    @Body() d: ParentRegistrationDto,
  ) {
    return this.service.submit(token, d);
  }
}
