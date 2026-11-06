import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChildrenService } from './children.service';
import {
  FamilyDto,
  ChildDto,
  SessionDto,
  CheckInDto,
  CheckoutDto,
  SessionActionDto,
  ChildrenQueryDto,
  ChildrenSummaryDto,
  CardDto,
  PickupDto,
  KioskDto,
  KioskCheckInDto,
} from './children.dto';
@Controller('children')
@Roles(...APP_ROLES)
export class ChildrenController {
  constructor(private readonly service: ChildrenService) {}
  @Get('options') options(@CurrentUser() u: AuthUser) {
    return this.service.options(u);
  }
  @Get() overview(@CurrentUser() u: AuthUser, @Query() q: ChildrenQueryDto) {
    return this.service.overview(u, q);
  }
  @Get('summary') summary(
    @CurrentUser() u: AuthUser,
    @Query() q: ChildrenSummaryDto,
  ) {
    return this.service.summary(u, q);
  }
  @Get('adult-members') members(
    @CurrentUser() u: AuthUser,
    @Query('branchId') branchId: string,
    @Query('search') search = '',
  ) {
    return this.service.memberSearch(u, branchId, search);
  }
  @Get('families/:id') family(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.family(u, id);
  }
  @Post('families') createFamily(
    @CurrentUser() u: AuthUser,
    @Body() d: FamilyDto,
  ) {
    return this.service.saveFamily(u, d);
  }
  @Patch('families/:id') updateFamily(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: FamilyDto,
  ) {
    return this.service.saveFamily(u, d, id);
  }
  @Post('families/:id/card') familyCard(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.rotateCard(u, 'family', id);
  }
  @Post('profiles') createChild(
    @CurrentUser() u: AuthUser,
    @Body() d: ChildDto,
  ) {
    return this.service.saveChild(u, d);
  }
  @Patch('profiles/:id') updateChild(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: ChildDto,
  ) {
    return this.service.saveChild(u, d, id);
  }
  @Post('profiles/:id/card') childCard(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.rotateCard(u, 'child', id);
  }
  @Post('sessions') session(@CurrentUser() u: AuthUser, @Body() d: SessionDto) {
    return this.service.createSession(u, d);
  }
  @Get('sessions/:id') roster(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.roster(u, id);
  }
  @Get('sessions/:id/families') findFamily(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Query('search') search = '',
  ) {
    return this.service.findFamily(u, id, search);
  }
  @Get('sessions/:id/families/:familyId') selectFamily(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('familyId') familyId: string,
  ) {
    return this.service.selectFamily(u, id, familyId);
  }
  @Post('sessions/:id/scan') scan(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: CardDto,
  ) {
    return this.service.scan(u, id, d.code);
  }
  @Post('sessions/:id/check-in') checkIn(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: CheckInDto,
  ) {
    return this.service.checkIn(u, id, d);
  }
  @Post('sessions/:id/pickup') pickup(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: PickupDto,
  ) {
    return this.service.pickup(u, id, d.code);
  }
  @Post('sessions/:id/check-out') checkout(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: CheckoutDto,
  ) {
    return this.service.checkout(u, id, d);
  }
  @Post('sessions/:id/action') action(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: SessionActionDto,
  ) {
    return this.service.sessionAction(u, id, d);
  }
  @Post('sessions/:id/kiosks') kiosk(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: KioskDto,
  ) {
    return this.service.createKiosk(u, id, d.label);
  }
  @Post('sessions/:id/kiosks/revoke') revoke(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.revokeKiosks(u, id);
  }
}
@Controller('children-kiosk')
export class ChildrenKioskController {
  constructor(private readonly service: ChildrenService) {}
  @Public() @Get() info(@Headers('x-children-kiosk') token: string) {
    return this.service.kioskInfo(token);
  }
  @Public() @Post('scan') scan(
    @Headers('x-children-kiosk') token: string,
    @Body() d: CardDto,
  ) {
    return this.service.kioskScan(token, d.code);
  }
  @Public() @Post('check-in') checkin(
    @Headers('x-children-kiosk') token: string,
    @Body() d: KioskCheckInDto,
  ) {
    return this.service.kioskCheckIn(token, d);
  }
}
