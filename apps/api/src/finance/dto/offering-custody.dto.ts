import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CustodyRevisionDto {
  @IsInt() @Min(0) revision!: number;
}

export class IssueBagDto extends CustodyRevisionDto {
  @IsString() @Matches(/\S/) @MaxLength(80) label!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) seal!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) collector!: string;
}

export class ReceiveBagDto extends CustodyRevisionDto {
  @IsString() @Matches(/\S/) @MaxLength(80) label!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) seal!: string;
}

export class RecordCountDto extends CustodyRevisionDto {
  @IsInt() @Min(0) @Max(1_000_000_000_000) minor!: number;
}

export class RecordDepositDto extends RecordCountDto {
  @IsString() @Matches(/\S/) @MaxLength(120) reference!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}
