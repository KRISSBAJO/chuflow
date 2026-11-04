import { Body, Controller, Delete, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreatePushSubscriptionDto,
  RemovePushSubscriptionDto,
} from './dto/push-subscription.dto';
import { PushService } from './push.service';

@ApiTags('Push notifications')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('config')
  config() {
    return this.pushService.getPublicConfig();
  }

  @Post('subscriptions')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushService.subscribe(user, dto, userAgent);
  }

  @Delete('subscriptions')
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: RemovePushSubscriptionDto,
  ) {
    return this.pushService.unsubscribe(user, dto);
  }

  @Post('test')
  test(@CurrentUser() user: AuthUser) {
    return this.pushService.sendTest(user);
  }
}
