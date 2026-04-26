import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.touchLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      oversightRegion: user.oversightRegion,
      district: user.district,
      branchId: user.branchId?.toString(),
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        oversightRegion: user.oversightRegion,
        district: user.district,
        branchId: user.branchId,
      },
      cookieName: this.configService.get<string>('cookieName') ?? 'cms_access_token',
    };
  }

  async me(userId: string) {
    return this.usersService.findById(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const user = await this.usersService.findById(userId);
    const userWithPassword = await this.usersService.findByEmailWithPassword(user.email);

    if (!userWithPassword) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, userWithPassword.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.usersService.updatePassword(userId, dto.newPassword);

    return {
      message: 'Password changed successfully',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      return {
        message: 'If an account exists for that email, password reset instructions have been prepared.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.usersService.setPasswordResetToken(user.id, tokenHash, expiresAt);

    const webUrl = this.configService.get<string>('webUrl') ?? 'http://localhost:3001';
    const resetUrl = `${webUrl}/reset-password?token=${rawToken}`;
    const mailResult = await this.mailService.sendPasswordResetEmail(
      user.email,
      resetUrl,
      expiresAt.toISOString(),
    );

    return {
      message: mailResult.delivered
        ? 'Password reset email sent successfully.'
        : 'Password reset link generated. SMTP is not configured, so a preview link is returned.',
      resetToken: mailResult.delivered ? undefined : rawToken,
      resetUrl: mailResult.previewUrl,
      expiresAt: expiresAt.toISOString(),
      delivery: mailResult.delivered ? 'email' : 'preview',
    };
  }

  async verifyResetToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findByPasswordResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    return {
      valid: true,
      email: user.email,
      expiresAt: user.passwordResetExpiresAt?.toISOString() ?? null,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.usersService.findByPasswordResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    await this.usersService.updatePassword(user.id, dto.newPassword);

    return {
      message: 'Password has been reset successfully',
    };
  }
}
