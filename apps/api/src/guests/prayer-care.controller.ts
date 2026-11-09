import { Body, Controller, Get, Header, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { RequiresFeature } from '../platform/requires-feature.decorator';
import { PrayerCareService, UpdatePrayerCareDto } from './prayer-care.service';

@Controller('guests/prayer-care')
@Roles('super_admin', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up')
@RequiresFeature('guests')
export class PrayerCareController {
  constructor(private readonly prayerCare: PrayerCareService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('view') view?: string) {
    return this.prayerCare.list(user, Number(page), view);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePrayerCareDto) {
    return this.prayerCare.update(user, id, dto);
  }
}
