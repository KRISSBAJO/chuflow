import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveWeeklyDto {
  @IsMongoId() branchId!: string;
  @IsDateString() weekEnding!: string;
  @IsObject() figures!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(4000) remarks?: string;
  @IsOptional() @IsBoolean() submit?: boolean;
  @IsOptional() @IsInt() @Min(0) revision?: number;
}
export class ForwardWeeklyDto {
  @IsString() @MaxLength(200) district!: string;
  @IsString() @MaxLength(200) oversightRegion!: string;
  @IsDateString() weekEnding!: string;
  @IsMongoId() recipientId!: string;
}
export class ReviewWeeklyDto {
  @IsInt() @Min(0) revision!: number;
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
}
export class ReviewPacketDto {
  @IsIn(['acknowledged', 'returned']) decision!: 'acknowledged' | 'returned';
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
}
