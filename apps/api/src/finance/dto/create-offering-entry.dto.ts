import { ApiProperty, PartialType } from '@nestjs/swagger';
import { FormAnswersDto } from '../../guests/form-answers.dto';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOfferingEntryDto extends FormAnswersDto {
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

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsMongoId()
  serviceTypeId?: string | null;

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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentChannel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOfferingBatchDto {
  @IsString()
  @Matches(/^[a-f0-9-]{24,80}$/i)
  requestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateOfferingEntryDto)
  entries!: CreateOfferingEntryDto[];
}

export class UpdateOfferingEntryDto extends PartialType(
  CreateOfferingEntryDto,
) {
  @IsOptional()
  @IsInt()
  @Min(0)
  reviewRevision?: number;
}
