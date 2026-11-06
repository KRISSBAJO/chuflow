import { Type } from 'class-transformer';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEmail,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsInt,
  Min,
  Max,
  Matches,
  IsUUID,
  Equals,
  IsIn,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
export class ParentAdultDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsString() @MinLength(5) @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(2) @MaxLength(60) relationship!: string;
}
export class ParentChildDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3, { each: true })
  pickupAdults!: number[];
  @IsString() @MaxLength(2000) careNotes!: string;
}
export class ParentRegistrationDto {
  @IsUUID() requestKey!: string;
  @IsString() @MinLength(2) @MaxLength(120) familyName!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ParentAdultDto)
  adults!: ParentAdultDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ParentChildDto)
  children!: ParentChildDto[];
  @Equals(true) consent!: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
export class RegistrationReviewDto {
  @IsIn(['approve', 'reject', 'handled']) action!: string;
  @IsInt() @Min(0) expectedRevision!: number;
  @IsString() @MinLength(10) @MaxLength(2000) note!: string;
  @IsBoolean() guardianVerified!: boolean;
  @IsBoolean() duplicatesChecked!: boolean;
  @IsBoolean() registerAsMembers!: boolean;
  @IsOptional() @IsBoolean() allowDuplicate?: boolean;
  @IsOptional() @IsMongoId() existingFamilyId?: string;
}
