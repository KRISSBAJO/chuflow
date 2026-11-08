import { FormAnswersDto } from '../guests/form-answers.dto';
import { Type } from 'class-transformer';
import {
  IsString,
  MinLength,
  MaxLength,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsEmail,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUrl,
  IsIn,
  Matches,
} from 'class-validator';
export class GuardianDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsString() @MinLength(5) @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(2) @MaxLength(60) relationship!: string;
  @IsOptional() @IsMongoId() memberId?: string;
  @IsBoolean() canCheckIn!: boolean;
}
export class FamilyDto extends FormAnswersDto {
  @IsOptional() @IsUUID() registrationKey?: string;
  @IsMongoId() branchId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians!: GuardianDto[];
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
export class ChildDto extends FormAnswersDto {
  @IsOptional() @IsUUID() registrationKey?: string;
  @IsMongoId() familyId!: string;
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsUUID(undefined, { each: true })
  guardianIds!: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsUUID(undefined, { each: true })
  pickupGuardianIds!: string[];
  @IsString() @MaxLength(3000) careNotes!: string;
  @IsString() @MaxLength(3000) pickupNotes!: string;
  @IsBoolean() photoConsent!: boolean;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  photoUrl?: string;
  @IsBoolean() isMember!: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
export class RoomDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsInt() @Min(0) @Max(216) minMonths!: number;
  @IsInt() @Min(0) @Max(216) maxMonths!: number;
  @IsInt() @Min(1) @Max(500) capacity!: number;
}
export class SessionDto {
  @IsOptional() @IsUUID() registrationKey?: string;
  @IsMongoId() branchId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  rooms!: RoomDto[];
}
export class ChildPlacementDto {
  @IsMongoId() childId!: string;
  @IsUUID() roomId!: string;
}
export class CheckInDto {
  @IsMongoId() familyId!: string;
  @IsUUID() guardianId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChildPlacementDto)
  children!: ChildPlacementDto[];
  @IsBoolean() adultConfirmed!: boolean;
}
export class CardDto {
  @IsString() @MinLength(20) @MaxLength(100) code!: string;
}
export class KioskCheckInDto extends CheckInDto {
  @IsString() @MinLength(20) @MaxLength(100) code!: string;
}
export class PickupDto {
  @IsString() @MinLength(3) @MaxLength(1000) code!: string;
}
export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsUUID(undefined, { each: true })
  visitIds!: string[];
  @IsUUID() guardianId!: string;
  @IsBoolean() identityConfirmed!: boolean;
  @IsOptional() @IsString() @MaxLength(100) pickupCode?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  exceptionReason?: string;
  @IsInt() @Min(0) expectedRevision!: number;
}
export class SessionActionDto {
  @IsIn(['close', 'transfer', 'reissue']) action!: string;
  @IsOptional() @IsUUID() visitId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsInt() @Min(0) expectedRevision!: number;
}
export class KioskDto {
  @IsString() @MinLength(2) @MaxLength(80) label!: string;
}
export class ChildrenQueryDto {
  @IsOptional() @Matches(/^\d{1,5}$/) sessionPage?: string;
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Matches(/^\d{1,5}$/) page?: string;
}

export class ChildrenSummaryDto {
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsString() @MaxLength(100) oversightRegion?: string;
  @IsOptional() @IsString() @MaxLength(100) district?: string;
  @IsOptional() @Matches(/^\d{1,3}$/) days?: string;
}
