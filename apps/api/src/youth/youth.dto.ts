import { Equals, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { OmitType, PickType } from '@nestjs/swagger';

export class YouthBranchDto {
  @IsMongoId() branchId!: string;
}
export const youthFollowUpReasons = ['welcome', 'missed', 'invite'] as const;
export const youthFollowUpOutcomes = ['open', 'connected', 'no_response', 'declined'] as const;

export class YouthCampFollowUpDto {
  @IsMongoId() ownerId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) dueDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
  @IsIn(youthFollowUpReasons) reason!: typeof youthFollowUpReasons[number];
  @IsIn(youthFollowUpOutcomes) outcome!: typeof youthFollowUpOutcomes[number];
  @IsInt() @Min(0) revision!: number;
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
export class YouthEventDto extends OmitType(YouthGroupDto, ['meetingDay'] as const) {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) eventDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) registrationDeadline!: string;
  @IsString() @Matches(/\S/) @MaxLength(160) venue!: string;
  @IsInt() @Min(1) @Max(2000) capacity!: number;
}
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
  @IsOptional() @IsBoolean() transportConsent?: boolean;
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

export class YouthCampDto extends YouthEventDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) campEndDate!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(0) @Max(100000000) feeMinor!: number;
  @IsInt() @Min(0) @Max(100000000) depositMinor!: number;
}
export class YouthCampLinkDto {
  @IsBoolean() enabled!: boolean;
}
export class YouthCampLogisticsDto {
  @IsString() @MaxLength(120) transport!: string;
  @IsString() @MaxLength(120) room!: string;
}
export class YouthCampFinanceDto {
  @Matches(/^[a-f0-9-]{36}$/i) requestId!: string;
  @IsIn(['payment', 'scholarship', 'refund', 'scholarship_reversal']) kind!: 'payment' | 'scholarship' | 'refund' | 'scholarship_reversal';
  @IsInt() @Min(1) @Max(100000000) amount!: number;
  @IsInt() @Min(0) revision!: number;
}
