import { ApiProperty, PartialType } from '@nestjs/swagger';
import { FormAnswersDto } from '../../guests/form-answers.dto';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseEntryDto extends FormAnswersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiProperty()
  @IsDateString()
  expenseDate!: string;

  @ApiProperty()
  @IsMongoId()
  accountId!: string;

  @ApiProperty()
  @IsMongoId()
  expenseCategoryId!: string;

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
  payee?: string;

  @ApiProperty()
  @IsString()
  description!: string;

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
  receiptUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExpenseEntryDto extends PartialType(CreateExpenseEntryDto) {
  @IsOptional()
  @IsInt()
  @Min(0)
  reviewRevision?: number;
}

export class ReviewExpenseEntryDto {
  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reviewRevision?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
