import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getAuthCookieOptions(includeLifetime = true): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      sameSite:
        (this.configService.get<'lax' | 'strict' | 'none'>('cookieSameSite') ??
          'lax') as CookieOptions['sameSite'],
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
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Login and set auth cookie' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    response.cookie(result.cookieName, result.accessToken, this.getAuthCookieOptions());

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
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
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser() user: { sub: string }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
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
