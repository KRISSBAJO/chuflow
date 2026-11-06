import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsObject,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class StartImportDto {
  @IsMongoId() branchId!: string;
  @IsIn(['guests', 'members', 'service_units']) kind!: string;
  @IsUUID() requestKey!: string;
  @IsInt() @Min(1) @Max(10000) expectedRows!: number;
  @IsIn(['iso', 'mdy', 'dmy']) dateFormat!: string;
}
export class ImportInputRow {
  @IsInt() @Min(2) @Max(1000000) sourceRow!: number;
  @IsObject() values!: Record<string, string>;
}
export class UploadImportDto {
  @IsInt() @Min(0) @Max(9999) offset!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportInputRow)
  rows!: ImportInputRow[];
}
export class CommitImportDto {
  @IsMongoId() branchId!: string;
  @IsInt() @Min(1) @Max(10000) expectedValid!: number;
}
