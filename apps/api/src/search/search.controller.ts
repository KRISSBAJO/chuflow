import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(
  'super_admin',
  'national_admin',
  'national_pastor',
  'district_admin',
  'district_pastor',
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
  'follow_up',
  'usher',
)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  globalSearch(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('type')
    type?: 'all' | 'guests' | 'members' | 'branches' | 'users' | 'followups',
    @Query('limit') limit?: string,
  ) {
    return this.searchService.globalSearch(user, {
      q,
      type,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
