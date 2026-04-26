import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOfferingEntryDto {
  @ApiProperty()
  @IsDateString()
  serviceDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceScheduleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceInstanceId?: string;

  @ApiProperty()
  @IsMongoId()
  serviceTypeId!: string;

  @ApiProperty()
  @IsMongoId()
  offeringTypeId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  accountId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOfferingEntryDto extends PartialType(CreateOfferingEntryDto) {}
