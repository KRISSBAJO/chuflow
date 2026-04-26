import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateCommunicationTemplateDto,
  UpdateCommunicationTemplateDto,
} from './dto/manage-template.dto';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';

@ApiTags('Communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('super_admin', 'national_admin', 'national_pastor', 'district_admin', 'district_pastor', 'branch_admin', 'resident_pastor', 'associate_pastor', 'follow_up')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post('send')
  send(@CurrentUser() user: AuthUser, @Body() dto: CreateCommunicationDto) {
    return this.communicationsService.send(dto, user);
  }

  @Get('templates')
  listTemplates(@CurrentUser() user: AuthUser) {
    return this.communicationsService.listTemplates(user);
  }

  @Roles('super_admin')
  @Post('templates')
  createTemplate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommunicationTemplateDto,
  ) {
    return this.communicationsService.createTemplate(dto, user);
  }

  @Roles('super_admin')
  @Patch('templates/:id')
  updateTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommunicationTemplateDto,
  ) {
    return this.communicationsService.updateTemplate(id, dto, user);
  }

  @Get('history')
  listHistory(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('deliveryMode') deliveryMode?: string,
    @Query('templateName') templateName?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communicationsService.listHistory(user, {
      branchId,
      channel,
      status,
      deliveryMode,
      templateName,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('guestId') guestId?: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.communicationsService.list(user, { guestId, memberId });
  }
}
