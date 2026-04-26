import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateServiceScheduleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiProperty()
  @IsMongoId()
  serviceTypeId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  dayOfWeek!: string;

  @ApiProperty()
  @IsString()
  startTime!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locationNotes?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  attendanceEntryEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  financeEntryEnabled?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceScheduleDto extends PartialType(CreateServiceScheduleDto) {}
