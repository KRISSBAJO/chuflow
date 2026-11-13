import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsISO8601, IsInt, IsMongoId, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { assetStates, type AssetState } from './asset.schema';

export class AssetImportRow {
  @IsOptional() @IsString() @MaxLength(64) tag?: string;
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) category!: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsString() @MaxLength(100) serial?: string;
}

export class RegisterAssetDto extends AssetImportRow {
  @IsMongoId() branchId!: string;
}

export class CreateAssetCategoryDto {
  @IsMongoId() branchId!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) name!: string;
}

export class CreateAssetRoomDto {
  @IsMongoId() branchId!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
}

export class ImportAssetsDto {
  @IsMongoId() branchId!: string;
  @IsOptional() @IsString() @Matches(/^[a-f0-9-]{36}$/i) requestId?: string;
  @IsOptional() @IsInt() @Min(0) offset?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => AssetImportRow)
  rows!: AssetImportRow[];
}

export class AssetReservationKeyDto {
  @IsInt() @Min(0) revision!: number;
  @IsISO8601({ strict: true }) startsAt!: string;
}

export class ReserveAssetDto extends AssetReservationKeyDto {
  @IsISO8601({ strict: true }) endsAt!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) holder!: string;
  @IsString() @Matches(/\S/) @MaxLength(160) activity!: string;
}

export class TransferAssetDto {
  @IsInt() @Min(0) revision!: number;
  @IsMongoId() branchId!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) location!: string;
}

export class MoveAssetDto {
  @IsIn(assetStates) state!: AssetState;
  @IsInt() @Min(0) revision!: number;
  @IsOptional() @IsString() @MaxLength(120) holder?: string;
  @IsOptional() @IsString() @MaxLength(160) activity?: string;
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CreateAssetKitDto {
  @IsMongoId() branchId!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(50) @IsMongoId({ each: true }) assetIds!: string[];
}

export class MoveAssetKitDto {
  @IsMongoId() branchId!: string;
  @IsIn(['available', 'checked_out']) state!: 'available' | 'checked_out';
  @IsOptional() @IsString() @MaxLength(120) holder?: string;
  @IsOptional() @IsString() @MaxLength(160) activity?: string;
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string;
}

export class StartAssetStocktakeDto {
  @IsMongoId() branchId!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) room!: string;
}

export class ScanAssetStocktakeDto {
  @IsString() @Matches(/\S/) @MaxLength(512) label!: string;
}
