import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Ip,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PickType } from '@nestjs/swagger';
import { CreateGuestDto, UpdateGuestDto } from './dto/create-guest.dto';
import { MergeGuestsDto } from './dto/merge-guests.dto';
import { DuplicateGuestError, GuestsService } from './guests.service';
import { GuestFieldsService, MinistryFormKind } from './guest-fields.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AccessScopeService } from '../access-scope/access-scope.service';

class LegacyPublicGuestDto extends PickType(CreateGuestDto, [
  'branchId', 'firstName', 'lastName', 'phone', 'email', 'prayerRequest', 'wantsPastoralCall', 'heardAboutChurch', 'serviceType', 'customFields', 'formRevision',
] as const) {}

@ApiTags('Guests')
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService, private readonly guestFields: GuestFieldsService, private readonly accessScope: AccessScopeService) {}

  private async ownBranch(user: AuthUser) {
    if (user.role !== 'branch_admin' && user.role !== 'resident_pastor') throw new ForbiddenException();
    const branchId = await this.accessScope.resolveScopedBranchId(user);
    if (!branchId) throw new ForbiddenException();
    return branchId;
  }

  @Get('branch-form-settings')
  @Roles('branch_admin', 'resident_pastor')
  async branchFormSettings(@CurrentUser() user: AuthUser) {
    return this.guestFields.overview('guest', await this.ownBranch(user));
  }

  @Patch('branch-form-settings')
  @Roles('branch_admin', 'resident_pastor')
  async publishBranchFormSettings(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.guestFields.publish(body, user, 'guest', await this.ownBranch(user));
  }

  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Get('ministry-form-settings/:kind')
  ministrySettings(@Param('kind', new ParseEnumPipe(MinistryFormKind)) kind: MinistryFormKind) {
    return this.guestFields.overview(kind);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Patch('ministry-form-settings/:kind')
  publishMinistrySettings(@Param('kind', new ParseEnumPipe(MinistryFormKind)) kind: MinistryFormKind, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.guestFields.publish(body, user, kind);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ministry-form/:kind')
  ministryForm(@Param('kind', new ParseEnumPipe(MinistryFormKind)) kind: MinistryFormKind) {
    return this.guestFields.staff(kind);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Get('form-settings')
  getFormSettings() {
    return this.guestFields.overview();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Patch('form-settings')
  publishFormSettings(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.guestFields.publish(body, user);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up', 'usher')
  @Get('staff-form')
  async staffForm(@CurrentUser() user: AuthUser, @Query('branchId') requestedBranchId?: string) {
    const branchId = await this.accessScope.resolveScopedBranchId(user, requestedBranchId);
    return { ...await this.guestFields.staff('guest', branchId), branchId: branchId?.toLowerCase() ?? null };
  }

  @Public()
  @Post('public-register')
  async createPublic(@Body() dto: LegacyPublicGuestDto, @Ip() ip: string) {
    this.guestFields.limitPublicSubmission(ip);
    await this.guestFields.assertPublicEnabled();
    const definition = await this.guestFields.get('guest', dto.branchId);
    this.guestFields.checkRevision(definition, dto.formRevision);
    if (!dto.firstName.trim() || !dto.lastName.trim() || (dto.phone?.trim() && !/^\d{7,15}$/.test(dto.phone.replace(/\D/g, ''))) ||
        Object.entries(dto).some(([key, value]) => typeof value === 'string' && value.length > (key === 'prayerRequest' ? 2000 : 250))) {
      throw new BadRequestException('Please check your guest registration details.');
    }
    const data = { ...dto } as LegacyPublicGuestDto & Record<string, unknown>;
    for (const key of definition.hiddenPublic) delete data[key];
    const answers = this.guestFields.collect(definition, 'public', dto.customFields);
    try {
      await this.guestsService.create(data, undefined, answers);
    } catch (error) {
      if (!(error instanceof DuplicateGuestError)) throw error;
    }
    return { received: true };
  }

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
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto, user);
  }

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
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.guestsService.findAll(
      user,
      branchId,
      search,
      Number(page) || 1,
      Number(limit) || 20,
      sort,
    );
  }

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
  )
  @Get('duplicates')
  duplicates(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.guestsService.findDuplicates(user, branchId);
  }

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
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.guestsService.findOne(id, user);
  }

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
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.update(id, dto, user);
  }

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
  )
  @Post(':id/merge')
  merge(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MergeGuestsDto,
  ) {
    return this.guestsService.mergeGuests(id, dto.sourceGuestId, user);
  }
}
