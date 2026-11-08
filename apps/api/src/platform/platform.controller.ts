import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JsonSubmissionGuard } from '../common/guards/json-submission.guard';
import {
  CurrentOperator,
  OperatorAuthGuard,
  OperatorRoles,
} from './operator-auth.guard';
import { OperatorsService, type OperatorClaims } from './operators.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';
import { PlatformWorkspacesService } from './platform-workspaces.service';
import {
  AuditQueryDto,
  CreateOperatorDto,
  OperatorLoginDto,
  OptionalReasonDto,
  PlanDto,
  ProvisionWorkspaceDto,
  ReasonDto,
  RecordPaymentDto,
  SetSubscriptionDto,
  UpdateOperatorDto,
  UpdateWorkspaceDto,
  WorkspaceListQueryDto,
} from './platform.dto';

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function handleParam(value: string) {
  if (value.length > 64 || !HANDLE.test(value))
    throw new NotFoundException('Workspace not found');
  return value;
}

/*
 * The site admin API. `@Public()` skips the church sign-in guard; the operator guard then
 * requires an operator session instead and answers 404 where the control plane is off.
 */
@ApiTags('Platform')
@Public()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly operators: OperatorsService,
    private readonly workspaces: PlatformWorkspacesService,
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly audit: PlatformAuditService,
  ) {}

  /* ---- operator sessions ---- */

  @Post('auth/login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JsonSubmissionGuard)
  login(@Body() dto: OperatorLoginDto, @Ip() ip: string) {
    if (!this.operators.enabled) throw new NotFoundException();
    return this.operators.login(dto.email, dto.password, ip);
  }

  @Get('auth/me')
  @UseGuards(OperatorAuthGuard)
  me(@CurrentOperator() operator: OperatorClaims) {
    return operator;
  }

  /* ---- operators ---- */

  @Get('operators')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner')
  listOperators() {
    return this.operators.list();
  }

  @Post('operators')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner')
  async createOperator(
    @CurrentOperator() operator: OperatorClaims,
    @Body() dto: CreateOperatorDto,
  ) {
    const created = await this.operators.create(dto);
    await this.audit.record(operator, 'operator.created', {
      details: { email: created.email, role: created.role },
    });
    return created;
  }

  @Patch('operators/:id')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner')
  async updateOperator(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: UpdateOperatorDto,
  ) {
    const updated = await this.operators.update(id, dto, operator.sub);
    await this.audit.record(operator, 'operator.updated', {
      details: { id, fields: Object.keys(dto) },
    });
    return updated;
  }

  /* ---- overview and plans ---- */

  @Get('overview')
  @UseGuards(OperatorAuthGuard)
  async overview() {
    const [workspaces, billing] = await Promise.all([
      this.workspaces.list(),
      this.subscriptions.overview(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const workspace of workspaces)
      byStatus[workspace.status] = (byStatus[workspace.status] ?? 0) + 1;
    return { workspaces: { total: workspaces.length, byStatus }, billing };
  }

  @Get('plans')
  @UseGuards(OperatorAuthGuard)
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Put('plans/:id')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'billing')
  savePlan(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: PlanDto,
  ) {
    if (!/^[a-z0-9_-]{1,40}$/.test(id))
      throw new NotFoundException('Plan not found');
    return this.subscriptions.upsertPlan(operator, id, dto);
  }

  /* ---- workspaces ---- */

  @Get('workspaces')
  @UseGuards(OperatorAuthGuard)
  listWorkspaces(@Query() query: WorkspaceListQueryDto) {
    return this.workspaces.list(query.status);
  }

  @Post('workspaces')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'support')
  provision(
    @CurrentOperator() operator: OperatorClaims,
    @Body() dto: ProvisionWorkspaceDto,
  ) {
    return this.workspaces.provision(operator, dto);
  }

  @Get('workspaces/:id')
  @UseGuards(OperatorAuthGuard)
  getWorkspace(@Param('id') id: string) {
    return this.workspaces.detail(handleParam(id));
  }

  @Patch('workspaces/:id')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'support')
  updateWorkspace(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(operator, handleParam(id), dto);
  }

  @Post('workspaces/:id/suspend')
  @HttpCode(200)
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'support', 'billing')
  suspend(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.workspaces.suspend(operator, handleParam(id), dto.reason);
  }

  @Post('workspaces/:id/reactivate')
  @HttpCode(200)
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'support', 'billing')
  reactivate(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.workspaces.reactivate(operator, handleParam(id), dto.reason);
  }

  @Post('workspaces/:id/archive')
  @HttpCode(200)
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner')
  archive(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.workspaces.archive(operator, handleParam(id), dto.reason);
  }

  @Get('workspaces/:id/usage')
  @UseGuards(OperatorAuthGuard)
  usage(@Param('id') id: string) {
    return this.workspaces.usage(handleParam(id));
  }

  /* ---- subscriptions ---- */

  @Put('workspaces/:id/subscription')
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'billing')
  async setSubscription(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: SetSubscriptionDto,
  ) {
    await this.workspaces.get(handleParam(id));
    const { reason, ...input } = dto;
    return this.subscriptions.set(operator, id, input, reason);
  }

  @Post('workspaces/:id/payments')
  @HttpCode(200)
  @UseGuards(OperatorAuthGuard)
  @OperatorRoles('owner', 'billing')
  async recordPayment(
    @CurrentOperator() operator: OperatorClaims,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    await this.workspaces.get(handleParam(id));
    return this.subscriptions.recordPayment(operator, id, dto);
  }

  /* ---- audit ---- */

  @Get('audit')
  @UseGuards(OperatorAuthGuard)
  listAudit(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
