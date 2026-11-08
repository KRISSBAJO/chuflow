import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BILLING_MODES,
  FEATURE_KEYS,
  OPERATOR_ROLES,
  SUBSCRIPTION_STATUSES,
  WORKSPACE_STATUSES,
  type BillingMode,
  type FeatureKey,
  type OperatorRole,
  type SubscriptionStatus,
  type WorkspaceStatus,
} from './platform.types';

export class OperatorLoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(8, 200)
  password!: string;
}

export class CreateOperatorDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(12, 200)
  password!: string;

  @IsIn(OPERATOR_ROLES)
  role!: OperatorRole;
}

export class UpdateOperatorDto {
  @IsOptional()
  @IsIn(OPERATOR_ROLES)
  role?: OperatorRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(12, 200)
  password?: string;
}

export class QuotasDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) branches?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) users?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) members?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) children?: number | null;
}

export class PlanDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(FEATURE_KEYS, { each: true })
  features!: FeatureKey[];

  @IsObject()
  @ValidateNested()
  @Type(() => QuotasDto)
  quotas!: QuotasDto;

  @IsInt()
  @Min(0)
  priceMonthlyCents!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @IsInt()
  @Min(0)
  @Max(365)
  trialDays!: number;

  @IsOptional()
  @IsBoolean()
  retired?: boolean;
}

export class ProvisionWorkspaceDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,64}$/i)
  handle!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  adminEmail!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]{1,40}$/)
  planId?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(254) ownerEmail?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ReasonDto {
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class OverridesDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(FEATURE_KEYS, { each: true })
  features?: FeatureKey[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => QuotasDto)
  quotas?: QuotasDto;
}

export class SetSubscriptionDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{1,40}$/)
  planId!: string;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsIn(BILLING_MODES)
  billingMode?: BillingMode;

  @IsOptional()
  @IsISO8601()
  trialEndsAt?: string | null;

  @IsOptional()
  @IsISO8601()
  currentPeriodEnd?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OverridesDto)
  overrides?: OverridesDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RecordPaymentDto {
  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @IsString()
  @Length(1, 120)
  reference!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class WorkspaceListQueryDto {
  @IsOptional()
  @IsIn(WORKSPACE_STATUSES)
  status?: WorkspaceStatus;
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  workspaceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
