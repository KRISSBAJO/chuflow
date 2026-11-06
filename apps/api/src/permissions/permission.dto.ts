import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { PERMISSION_CATALOG } from '../common/permissions';

export class GrantPermissionsDto {
  @IsMongoId() recipientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsIn(PERMISSION_CATALOG.map((p) => p.key), { each: true })
  permissions!: string[];

  @IsOptional() @IsDateString() expiresAt?: string;

  @IsInt() @Min(0) expectedRevision!: number;

  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class RevokePermissionDto {
  @IsInt() @Min(0) expectedRevision!: number;

  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
