import { Equals, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { OmitType, PickType } from '@nestjs/swagger';

export class YouthBranchDto {
  @IsMongoId() branchId!: string;
}
export class YouthGroupDto extends YouthBranchDto {
  @IsString() @Matches(/\S/) @MaxLength(80) program!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) name!: string;
  @IsInt() @Min(10) @Max(99) minAge!: number;
  @IsInt() @Min(10) @Max(99) maxAge!: number;
  @IsInt() @Min(0) @Max(6) meetingDay!: number;
  @IsInt() @Min(18) @Max(25) guardianUnderAge!: number;
}
export class YouthLeaderDto {
  @IsMongoId() leaderId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) clearanceUntil!: string;
  @Equals(true) screeningVerified!: true;
}
export class YouthGroupSettingsDto extends OmitType(YouthGroupDto, ['branchId'] as const) {}
export class YouthRegistrationDto {
  @IsString() @Matches(/\S/) @MaxLength(80) firstName!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) lastName!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) birthDate!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) contact!: string;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(160) guardianName?: string;
  @Equals(true) consent!: true;
  @Equals(1) consentVersion!: 1;
  @IsIn(['en', 'es', 'fr', 'pt']) locale!: string;
  @IsOptional() @IsInt() @Min(0) formRevision?: number;
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
}
export class YouthReviewDto {
  @IsIn(['active', 'declined']) state!: 'active' | 'declined';
  @IsOptional() @IsBoolean() guardianVerified?: boolean;
  @IsOptional() @IsMongoId() memberId?: string;
  @IsOptional() @IsMongoId() childId?: string;
}
export class YouthTransitionDto extends PickType(YouthRegistrationDto, ['contact', 'guardianName', 'consent', 'consentVersion', 'locale'] as const) {
  @IsMongoId() destinationId!: string;
}
export class YouthAttendanceDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
  @IsMongoId() enrollmentId!: string;
  @IsBoolean() present!: boolean;
}
