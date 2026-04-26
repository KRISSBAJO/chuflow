import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateVisitDto {
  @ApiProperty()
  @IsMongoId()
  guestId!: string;

  @ApiProperty()
  @IsMongoId()
  branchId!: string;

  @ApiProperty()
  @IsDateString()
  visitDate!: string;

  @ApiProperty()
  @IsString()
  serviceType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVisitDto extends PartialType(CreateVisitDto) {}
