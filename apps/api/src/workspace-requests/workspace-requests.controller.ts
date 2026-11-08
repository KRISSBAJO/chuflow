import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateWorkspaceRequestDto } from './dto/create-workspace-request.dto';
import { UpdateWorkspaceRequestDto } from './dto/update-workspace-request.dto';
import { WorkspaceRequestsService } from './workspace-requests.service';
import { SubscriptionExempt } from '../platform/entitlements.guard';

@Injectable()
export class WorkspaceHandleRateGuard implements CanActivate {
  private window = -1;
  private readonly hits = new Map<string, number>();

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const ip = http.getRequest<{ ip?: string }>().ip ?? 'unknown';
    const now = Date.now();
    const window = Math.floor(now / 60_000);
    if (window !== this.window) {
      this.window = window;
      this.hits.clear();
    }
    const count = this.hits.get(ip) ?? 0;
    if (count >= 60 || (count === 0 && this.hits.size >= 10_000)) {
      http.getResponse<{ setHeader(name: string, value: string): void }>()
        .setHeader('Retry-After', String(Math.ceil((60_000 - now % 60_000) / 1000)));
      throw new HttpException('Please try again shortly.', 429);
    }
    this.hits.set(ip, count + 1);
    return true;
  }
}

@ApiTags('Workspace Requests')
@Controller('workspace-requests')
export class WorkspaceRequestsController {
  constructor(
    private readonly workspaceRequestsService: WorkspaceRequestsService,
  ) {}

  @Public()
  @UseGuards(WorkspaceHandleRateGuard)
  @Get('public/handle')
  @SubscriptionExempt()
  checkHandle(@Query('handle') handle?: string) {
    return this.workspaceRequestsService.checkHandle(handle);
  }

  @Public()
  @Post()
  @SubscriptionExempt()
  create(
    @Body() dto: CreateWorkspaceRequestDto,
  ): Promise<Record<string, unknown>> {
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
