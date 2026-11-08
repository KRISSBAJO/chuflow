import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AllowTemporaryPassword, JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, Length, Matches } from 'class-validator';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { JsonSubmissionGuard } from '../common/guards/json-submission.guard';
import { Public } from '../common/decorators/public.decorator';

class WorkspaceHandoffDto {
  @IsString()
  @Length(1, 4096)
  @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  handoff!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private getAuthCookieOptions(includeLifetime = true): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      sameSite: (this.configService.get<'lax' | 'strict' | 'none'>(
        'cookieSameSite',
      ) ?? 'lax') as CookieOptions['sameSite'],
      secure: this.configService.get<boolean>('cookieSecure') ?? false,
      domain: this.configService.get<string>('cookieDomain') || undefined,
      path: '/',
    };

    if (includeLifetime) {
      options.maxAge = 1000 * 60 * 60 * 24;
    }

    return options;
  }

  @Public()
  @Get('workspace')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Name the workspace this API serves' })
  workspace() {
    return this.authService.workspaceInfo();
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Login and set auth cookie' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    response.cookie(
      result.cookieName,
      result.accessToken,
      this.getAuthCookieOptions(),
    );

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Public()
  @HttpCode(200)
  @Post('mobile/login')
  @ApiOperation({
    summary: 'Login from the mobile app and receive a bearer token',
  })
  async mobileLogin(@Body() loginDto: LoginDto) {
    const expiresIn =
      this.configService.get<string>('mobileJwtExpiresIn') ?? '30d';
    const result = await this.authService.login(loginDto, { expiresIn });

    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: result.user,
    };
  }

  @Get('workspaces')
  @Header('Cache-Control', 'no-store')
  listWorkspaces(@CurrentUser() user: { sub: string }) {
    return this.workspaceAccess.list(user.sub);
  }

  @Post('workspaces/:workspaceId/handoff')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(JsonSubmissionGuard)
  createWorkspaceHandoff(
    @CurrentUser() user: { sub: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceAccess.createHandoff(user.sub, workspaceId);
  }

  @Public()
  @Post('workspace/exchange')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(JsonSubmissionGuard)
  async exchangeWorkspaceHandoff(
    @Body() dto: WorkspaceHandoffDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = await this.workspaceAccess.redeem(dto.handoff);
    const { accessToken, user, cookieName } =
      await this.authService.startWorkspaceSession(userId);
    response.cookie(cookieName, accessToken, this.getAuthCookieOptions());
    return { accessToken, tokenType: 'Bearer', user };
  }

  @Post('browser-handoff')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(JsonSubmissionGuard)
  createBrowserHandoff(@CurrentUser() user: { sub: string }) {
    return this.workspaceAccess.createBrowserHandoff(user.sub);
  }

  @Public()
  @Post('browser-handoff/exchange')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(JsonSubmissionGuard)
  async exchangeBrowserHandoff(
    @Body() dto: WorkspaceHandoffDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = await this.workspaceAccess.redeem(dto.handoff, true);
    const { accessToken, user, cookieName } = await this.authService.startWorkspaceSession(userId);
    response.cookie(cookieName, accessToken, this.getAuthCookieOptions());
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @AllowTemporaryPassword()
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(
      this.configService.get<string>('cookieName') ?? 'cms_access_token',
      this.getAuthCookieOptions(false),
    );
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @AllowTemporaryPassword()
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @AllowTemporaryPassword()
  async changePassword(
    @CurrentUser() user: { sub: string; passwordChangeRequired?: boolean },
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('authorization') authorization?: string,
  ) {
    const result = await this.authService.changePassword(user.sub, dto);
    if (!user.passwordChangeRequired) return result;
    const mobile = /^Bearer /i.test(authorization ?? '');
    const expiresIn = mobile ? this.configService.get<string>('mobileJwtExpiresIn') ?? '30d' : undefined;
    const { accessToken, user: profile, cookieName } = await this.authService.startWorkspaceSession(user.sub, { expiresIn });
    response.cookie(cookieName, accessToken, this.getAuthCookieOptions());
    return { ...result, accessToken, user: profile };
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('reset-password/verify')
  verifyResetPasswordToken(@Query('token') token?: string) {
    if (!token) {
      return {
        valid: false,
        message: 'Reset token is required',
      };
    }

    return this.authService.verifyResetToken(token);
  }
}
