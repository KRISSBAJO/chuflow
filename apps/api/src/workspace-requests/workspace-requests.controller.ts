import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateWorkspaceRequestDto } from './dto/create-workspace-request.dto';
import { UpdateWorkspaceRequestDto } from './dto/update-workspace-request.dto';
import { WorkspaceRequestsService } from './workspace-requests.service';

@ApiTags('Workspace Requests')
@Controller('workspace-requests')
export class WorkspaceRequestsController {
  constructor(
    private readonly workspaceRequestsService: WorkspaceRequestsService,
  ) {}

  @Public()
  @Post()
  create(@Body() dto: CreateWorkspaceRequestDto): Promise<Record<string, unknown>> {
    return this.workspaceRequestsService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Get()
  list(
    @CurrentUser() _user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>> {
    return this.workspaceRequestsService.findAll({
      status,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 12,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles('super_admin')
  @Patch(':id')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceRequestDto,
  ): Promise<Record<string, unknown>> {
    return this.workspaceRequestsService.updateStatus(id, dto, user);
  }
}
