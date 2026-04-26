import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entryMode?: string;

  @ApiProperty()
  @IsMongoId()
  branchId!: string;

  @ApiProperty()
  @IsDateString()
  serviceDate!: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceTypeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceScheduleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceInstanceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  serviceTypeLabel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiProperty()
  @IsString()
  personType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  guestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  menCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  womenCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  childrenCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  adultsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  firstTimersCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  newConvertsCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  holySpiritBaptismCount?: number;
}

export class UpdateAttendanceDto extends PartialType(CreateAttendanceDto) {}
