import {
  IsString,
  IsMongoId,
  IsIn,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsInt,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  Matches,
  ValidateIf,
} from 'class-validator';
import { LEVELS, type ApprovalLevel } from './approval.schema';
export class SaveApprovalPolicyDto {
  @IsString() @MinLength(2) @MaxLength(100) oversightRegion!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @IsIn(LEVELS) finalLevel!: ApprovalLevel;
  @ValidateIf((_o: unknown, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000000)
  thresholdAmount?: number;
  @ValidateIf((o: SaveApprovalPolicyDto) => o.thresholdAmount !== undefined)
  @IsIn(LEVELS)
  aboveThresholdLevel?: ApprovalLevel;
  @IsString() @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(1) @Max(90) reviewDays!: number;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
export class SubmitApprovalDto {
  @IsMongoId() branchId!: string;
  @IsMongoId() policyId!: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MinLength(10) @MaxLength(20000) details!: string;
  @ValidateIf((_o: unknown, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000000)
  amount?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  @MaxLength(2000, { each: true })
  documentLinks?: string[];
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
export class ApprovalDecisionDto {
  @IsIn(['advance', 'reject', 'return', 'withdraw', 'escalate'])
  action!: string;
  @IsString() @MinLength(3) @MaxLength(5000) note!: string;
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsIn(LEVELS) targetLevel?: ApprovalLevel;
}
export class ApprovalQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'returned', 'withdrawn'])
  status?: string;
  @IsOptional() @IsIn(['mine', 'review', 'all', 'overdue']) view?: string;
  @IsOptional() @Matches(/^\d{1,6}$/) page?: string;
}
