import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { APP_ROLES } from '../common/constants/roles.constants';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ApprovalWorkflowsService } from './approval.service';
import {
  ApprovalDecisionDto,
  ApprovalQueryDto,
  SaveApprovalPolicyDto,
  SubmitApprovalDto,
} from './approval.dto';
@Controller('approval-workflows')
@Roles(...APP_ROLES)
export class ApprovalWorkflowsController {
  constructor(private readonly service: ApprovalWorkflowsService) {}
  @Get('options') options(@CurrentUser() u: AuthUser) {
    return this.service.options(u);
  }
  @Post('policies') @Roles('super_admin', 'national_admin') createPolicy(
    @CurrentUser() u: AuthUser,
    @Body() dto: SaveApprovalPolicyDto,
  ) {
    return this.service.savePolicy(u, dto);
  }
  @Patch('policies/:id') @Roles('super_admin', 'national_admin') updatePolicy(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveApprovalPolicyDto,
  ) {
    return this.service.savePolicy(u, dto, id);
  }
  @Post('preview') preview(
    @CurrentUser() u: AuthUser,
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.service
      .preview(u, dto)
      .then((r) => ({ stages: r.stages, finalLevel: r.finalLevel }));
  }
  @Get('requests') list(
    @CurrentUser() u: AuthUser,
    @Query() q: ApprovalQueryDto,
  ) {
    return this.service.list(u, q);
  }
  @Post('requests') submit(
    @CurrentUser() u: AuthUser,
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.service.submit(u, dto);
  }
  @Get('requests/:id') detail(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.detail(u, id);
  }
  @Post('requests/:id/resubmit') resubmit(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.service.submit(u, dto, id);
  }
  @Post('requests/:id/decision') decide(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
  ) {
    return this.service.decide(u, id, dto);
  }
}
