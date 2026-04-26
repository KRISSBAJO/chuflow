import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessScopeService } from '../access-scope/access-scope.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  UpdateAppSettingsDto,
  UpdateBranchSettingsDto,
  UpdateUserPreferencesDto,
} from './dto/update-settings.dto';
import { AppSetting, AppSettingDocument } from './schemas/app-setting.schema';
import {
  BranchSetting,
  BranchSettingDocument,
} from './schemas/branch-setting.schema';

export interface BranchSettingsResponse {
  branch: unknown;
  settings: unknown;
  canEdit: boolean;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSetting.name)
    private readonly appSettingModel: Model<AppSettingDocument>,
    @InjectModel(BranchSetting.name)
    private readonly branchSettingModel: Model<BranchSettingDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly accessScopeService: AccessScopeService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private getDefaultBranchSettings(branchId: string) {
    return {
      branchId,
      timezone: 'America/Chicago',
      currency: 'USD',
      locale: 'en-US',
      defaultServiceDurationMinutes: 120,
      attendanceApprovalRoles: [
        'branch_admin',
        'resident_pastor',
        'associate_pastor',
        'follow_up',
      ],
      publicGuestIntakeEnabled: true,
      publicMemberIntakeEnabled: true,
      publicAttendanceEntryEnabled: true,
      notifyOnMissingAttendance: true,
      notifyOnFollowUpBacklog: true,
      notifyOnFinanceApprovals: true,
      dailySummaryEnabled: false,
      weeklyLeadershipDigestEnabled: false,
    };
  }

  private async ensureAppSettings() {
    const existing = await this.appSettingModel
      .findOne({ scopeKey: 'global' })
      .lean();

    if (existing) {
      const shouldRefreshBranding =
        (existing.organizationName === 'ChurchFlow' ||
          existing.organizationName === 'Church Management System') &&
        [
          'Ministry, simplified.',
          'Ministry, beautifully managed.',
        ].includes(existing.organizationTagline);

      if (shouldRefreshBranding) {
        const updated = await this.appSettingModel
          .findOneAndUpdate(
            { scopeKey: 'global' },
            {
              organizationName: 'ChuFlow',
              organizationTagline: 'From Membership to Ministry',
            },
            { new: true },
          )
          .lean();

        if (updated) {
          return updated;
        }
      }

      return existing;
    }

    const created = await this.appSettingModel.create({
      scopeKey: 'global',
      organizationName: 'ChuFlow',
      organizationTagline: 'From Membership to Ministry',
      publicConnectEnabled: true,
      defaultReportDays: 30,
    });

    return created.toObject();
  }

  private async ensureBranchSettings(branchId: string) {
    const defaults = this.getDefaultBranchSettings(branchId);
    const existing = await this.branchSettingModel.findOne({ branchId }).lean();

    if (existing) {
      return {
        ...defaults,
        ...existing,
      };
    }

    const created = await this.branchSettingModel.create(defaults);

    return created.toObject();
  }

  async getOverview(currentUser: AuthUser) {
    const [app, user] = await Promise.all([
      this.ensureAppSettings(),
      this.userModel
        .findById(currentUser.sub)
        .select('-password -passwordResetToken')
        .lean(),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      app,
      preferences: {
        interfaceDensity: user.preferences?.interfaceDensity ?? 'comfortable',
        defaultReportDays:
          user.preferences?.defaultReportDays ?? app.defaultReportDays ?? 30,
      },
    };
  }

  async updateAppSettings(currentUser: AuthUser, dto: UpdateAppSettingsDto) {
    const current = await this.ensureAppSettings();

    const updated = await this.appSettingModel
      .findOneAndUpdate(
        { scopeKey: 'global' },
        {
          organizationName:
            this.normalizeText(dto.organizationName) ?? current.organizationName,
          organizationTagline:
            this.normalizeText(dto.organizationTagline) ??
            current.organizationTagline,
          publicConnectEnabled:
            dto.publicConnectEnabled ?? current.publicConnectEnabled ?? true,
          defaultReportDays: dto.defaultReportDays ?? current.defaultReportDays ?? 30,
        },
        { new: true, upsert: true },
      )
      .lean();

    if (updated) {
      await this.auditLogsService.record({
        entityType: 'settings',
        entityId: String(updated._id),
        action: 'updated',
        summary: 'Application settings updated',
        actor: currentUser,
        metadata: {
          organizationName: updated.organizationName,
          organizationTagline: updated.organizationTagline,
          publicConnectEnabled: updated.publicConnectEnabled,
          defaultReportDays: updated.defaultReportDays,
        },
      });
    }

    return updated;
  }

  async updateUserPreferences(
    currentUser: AuthUser,
    dto: UpdateUserPreferencesDto,
  ) {
    const app = await this.ensureAppSettings();
    const existingUser = await this.userModel
      .findById(currentUser.sub)
      .select('preferences')
      .lean();

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        currentUser.sub,
        {
          preferences: {
            interfaceDensity:
              dto.interfaceDensity ??
              existingUser.preferences?.interfaceDensity ??
              'comfortable',
            defaultReportDays:
              dto.defaultReportDays ??
              existingUser.preferences?.defaultReportDays ??
              app.defaultReportDays ??
              30,
          },
        },
        { new: true },
      )
      .select('-password -passwordResetToken')
      .lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      interfaceDensity: user.preferences?.interfaceDensity ?? 'comfortable',
      defaultReportDays:
        user.preferences?.defaultReportDays ?? app.defaultReportDays ?? 30,
    };
  }

  async getBranchSettings(
    currentUser: AuthUser,
    branchId: string,
  ): Promise<BranchSettingsResponse> {
    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    const [branch, settings] = await Promise.all([
      this.branchModel.findById(branchId).lean(),
      this.ensureBranchSettings(branchId),
    ]);

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return {
      branch,
      settings,
      canEdit: [
        'super_admin',
        'national_admin',
        'district_admin',
        'branch_admin',
      ].includes(currentUser.role),
    };
  }

  async updateBranchSettings(
    currentUser: AuthUser,
    branchId: string,
    dto: UpdateBranchSettingsDto,
  ) {
    await this.accessScopeService.ensureBranchAccess(currentUser, branchId);

    const branch = await this.branchModel.findById(branchId).lean();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const current = await this.ensureBranchSettings(branchId);

    const updated = await this.branchSettingModel
      .findOneAndUpdate(
        { branchId },
        {
          timezone: this.normalizeText(dto.timezone) ?? current.timezone,
          currency: this.normalizeText(dto.currency) ?? current.currency,
          locale: this.normalizeText(dto.locale) ?? current.locale,
          defaultServiceDurationMinutes:
            dto.defaultServiceDurationMinutes ??
            current.defaultServiceDurationMinutes,
          attendanceApprovalRoles:
            dto.attendanceApprovalRoles?.length
              ? dto.attendanceApprovalRoles
              : current.attendanceApprovalRoles,
          publicGuestIntakeEnabled:
            dto.publicGuestIntakeEnabled ?? current.publicGuestIntakeEnabled,
          publicMemberIntakeEnabled:
            dto.publicMemberIntakeEnabled ?? current.publicMemberIntakeEnabled,
          publicAttendanceEntryEnabled:
            dto.publicAttendanceEntryEnabled ??
            current.publicAttendanceEntryEnabled,
          notifyOnMissingAttendance:
            dto.notifyOnMissingAttendance ?? current.notifyOnMissingAttendance,
          notifyOnFollowUpBacklog:
            dto.notifyOnFollowUpBacklog ?? current.notifyOnFollowUpBacklog,
          notifyOnFinanceApprovals:
            dto.notifyOnFinanceApprovals ?? current.notifyOnFinanceApprovals,
          dailySummaryEnabled:
            dto.dailySummaryEnabled ?? current.dailySummaryEnabled,
          weeklyLeadershipDigestEnabled:
            dto.weeklyLeadershipDigestEnabled ??
            current.weeklyLeadershipDigestEnabled,
        },
        { new: true, upsert: true },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Branch settings not found');
    }

    await this.auditLogsService.record({
      entityType: 'branch_settings',
      entityId: String(updated._id),
      action: 'updated',
      summary: `Branch settings updated for ${branch.name}`,
      actor: currentUser,
      oversightRegion: branch.oversightRegion,
      district: branch.district,
      branchId,
      metadata: {
        timezone: updated.timezone,
        currency: updated.currency,
        locale: updated.locale,
        defaultServiceDurationMinutes: updated.defaultServiceDurationMinutes,
          attendanceApprovalRoles: updated.attendanceApprovalRoles,
          publicGuestIntakeEnabled: updated.publicGuestIntakeEnabled,
          publicMemberIntakeEnabled: updated.publicMemberIntakeEnabled,
          publicAttendanceEntryEnabled: updated.publicAttendanceEntryEnabled,
          notifyOnMissingAttendance: updated.notifyOnMissingAttendance,
          notifyOnFollowUpBacklog: updated.notifyOnFollowUpBacklog,
          notifyOnFinanceApprovals: updated.notifyOnFinanceApprovals,
          dailySummaryEnabled: updated.dailySummaryEnabled,
          weeklyLeadershipDigestEnabled: updated.weeklyLeadershipDigestEnabled,
        },
      });

    return {
      branch,
      settings: updated,
      canEdit: true,
    };
  }

  async getPublicSettings() {
    const app = await this.ensureAppSettings();

    return {
      organizationName: app.organizationName,
      organizationTagline: app.organizationTagline,
      publicConnectEnabled: app.publicConnectEnabled,
      defaultReportDays: app.defaultReportDays,
    };
  }
}
