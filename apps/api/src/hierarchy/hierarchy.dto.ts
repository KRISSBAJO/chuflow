import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
export class CreateHierarchyDto {
  @IsIn(['district', 'zone', 'area']) kind!: string;
  @IsMongoId() districtId!: string;
  @IsOptional() @IsMongoId() parentId?: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}
export class UpdateHierarchyDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsMongoId() headquartersBranchId?: string;
  @IsOptional() @IsMongoId() pastorUserId?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  clearAppointment?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
export class PlaceChurchDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsMongoId() unitId?: string;
  @IsOptional() @IsBoolean() unassigned?: boolean;
}
