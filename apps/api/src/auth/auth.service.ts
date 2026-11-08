import { PermissionsService } from '../permissions/permissions.service';
import {
  BadRequestException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
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
import type { User } from '../users/schemas/user.schema';
import { getWorkspace } from '../workspaces/workspace-boundary';
import { EntitlementsService } from '../platform/entitlements.service';
import { publicSnapshot } from '../platform/subscription-rules';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly permissions: PermissionsService,
    @Optional() private readonly entitlements?: EntitlementsService,
  ) {}

  async login(loginDto: LoginDto, options: { expiresIn?: string } = {}) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );

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

    return this.issueSession(user.id, user, options);
  }

  async startWorkspaceSession(
    userId: string,
    options: { expiresIn?: string } = {},
  ) {
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user?.isActive) {
      throw new UnauthorizedException('Authentication failed');
    }
    return this.issueSession(userId, user, options);
  }

  private async issueSession(
    userId: string,
    user: Pick<
      User,
      | 'email'
      | 'role'
      | 'firstName'
      | 'lastName'
      | 'oversightRegion'
      | 'district'
      | 'branchId'
    >,
    options: { expiresIn?: string },
  ) {
    await this.usersService.touchLastLogin(userId);

    const workspace = getWorkspace(this.configService);
    const payload = {
      workspaceId: workspace.id,
      sub: userId,
      email: user.email,
      role: user.role,
      oversightRegion: user.oversightRegion,
      district: user.district,
      branchId: user.branchId?.toString(),
    };

    const accessToken = await this.jwtService.signAsync(
      payload,
      options.expiresIn ? { expiresIn: options.expiresIn as never } : undefined,
    );

    return {
      accessToken,
      user: {
        workspace,
        id: userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        oversightRegion: user.oversightRegion,
        district: user.district,
        branchId: user.branchId,
      },
      cookieName:
        this.configService.get<string>('cookieName') ?? 'cms_access_token',
    };
  }

  async me(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(userId);
    return {
      ...user,
      ...(await this.permissions.resolve(user)),
      workspace: getWorkspace(this.configService),
      ...(this.entitlements
        ? { entitlements: publicSnapshot(await this.entitlements.snapshot()) }
        : {}),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.usersService.findById(userId);
    const userWithPassword = await this.usersService.findByEmailWithPassword(
      user.email,
    );

    if (!userWithPassword) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(
      dto.currentPassword,
      userWithPassword.password,
    );
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
        message:
          'If an account exists for that email, password reset instructions have been prepared.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.usersService.setPasswordResetToken(
      user.id,
      tokenHash,
      expiresAt,
    );

    const webUrl =
      this.configService.get<string>('webUrl') ?? 'http://localhost:3001';
    const resetUrl = `${webUrl}/reset-password?token=${rawToken}`;
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        resetUrl,
        expiresAt.toISOString(),
      );
    } catch {
      // Never expose reset credentials or account existence when delivery fails.
    }
    return {
      message:
        'If an account exists for that email, password reset instructions have been prepared.',
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

    await this.usersService.updatePassword(user.id, dto.newPassword, tokenHash);

    return {
      message: 'Password has been reset successfully',
    };
  }
}
