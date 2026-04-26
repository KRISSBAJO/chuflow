import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const REPORT_DAY_OPTIONS = [7, 14, 30, 60, 90];

export class UpdateAppSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  organizationTagline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  publicConnectEnabled?: boolean;

  @ApiProperty({ required: false, enum: REPORT_DAY_OPTIONS })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  @IsIn(REPORT_DAY_OPTIONS)
  defaultReportDays?: number;
}

export class UpdateUserPreferencesDto {
  @ApiProperty({ required: false, enum: ['comfortable', 'compact'] })
  @IsOptional()
  @IsString()
  @IsIn(['comfortable', 'compact'])
  interfaceDensity?: string;

  @ApiProperty({ required: false, enum: REPORT_DAY_OPTIONS })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  @IsIn(REPORT_DAY_OPTIONS)
  defaultReportDays?: number;
}

const BRANCH_APPROVAL_ROLE_OPTIONS = [
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
  'follow_up',
];

export class UpdateBranchSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiProperty({ required: false, minimum: 30, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(600)
  defaultServiceDurationMinutes?: number;

  @ApiProperty({
    required: false,
    enum: BRANCH_APPROVAL_ROLE_OPTIONS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(BRANCH_APPROVAL_ROLE_OPTIONS, { each: true })
  attendanceApprovalRoles?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  publicGuestIntakeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  publicMemberIntakeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  publicAttendanceEntryEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyOnMissingAttendance?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyOnFollowUpBacklog?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyOnFinanceApprovals?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  dailySummaryEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  weeklyLeadershipDigestEnabled?: boolean;
}
