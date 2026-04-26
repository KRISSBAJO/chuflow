import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseEntryDto {
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

export class UpdateExpenseEntryDto extends PartialType(CreateExpenseEntryDto) {}

export class ReviewExpenseEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
