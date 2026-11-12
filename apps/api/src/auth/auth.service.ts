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
import {
  FIRST_WORKSPACE_ID,
  getWorkspace,
  workspaceWebLink,
} from '../workspaces/workspace-boundary';
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
      | 'passwordChangeRequired'
    >,
    options: { expiresIn?: string },
  ) {
    await this.usersService.touchLastLogin(userId);

    const workspace = getWorkspace(this.configService);
    const payload = {
      workspaceId: workspace.id,
      ...(user.passwordChangeRequired === true ? { temporaryPassword: true } : {}),
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
        passwordChangeRequired: user.passwordChangeRequired === true,
      },
      cookieName:
        this.configService.get<string>('cookieName') ?? 'cms_access_token',
    };
  }

  /** Which church this API serves, for the sign-in page of a provisioned workspace. */
  workspaceInfo() {
    const workspace = getWorkspace(this.configService);
    return { ...workspace, primary: workspace.id === FIRST_WORKSPACE_ID };
  }

  async me(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(userId);
    return {
      ...user,
      passwordChangeRequired: user.passwordChangeRequired === true,
      ...(await this.permissions.resolve(user)),
      workspace: getWorkspace(this.configService),
      ...(this.entitlements
        ? { entitlements: publicSnapshot(await this.entitlements.snapshot()) }
        : {}),
    };
  }

  requestAccountDeletion(userId: string, password: string) {
    return this.usersService.requestAccountDeletion(userId, password);
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

    if (user.passwordChangeRequired === true) {
      await this.usersService.updatePassword(userId, dto.newPassword, undefined, userWithPassword.password);
    } else {
      await this.usersService.updatePassword(userId, dto.newPassword);
    }

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

    // The link carries the workspace so the web app resets the password in the right church.
    const resetUrl = workspaceWebLink(this.configService, '/reset-password', {
      token: rawToken,
    });
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
