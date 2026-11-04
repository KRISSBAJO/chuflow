import {
  IsIn,
  IsMongoId,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MemberDirectoryDto {
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsMongoId() serviceUnitId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @IsIn(['active', 'inactive', 'worker', 'new_member'])
  status?: string;
  @IsOptional() @IsIn(['yes', 'pending']) foundation?: string;
  @IsOptional() @IsIn(['yes', 'pending']) holySpirit?: string;
  @IsOptional()
  @IsIn(['newest', 'oldest', 'name_asc', 'name_desc'])
  sort?: string;
  @IsOptional() @IsNumberString({ no_symbols: true }) page?: string;
  @IsOptional() @IsIn(['25', '50', '100']) pageSize?: string;
}
