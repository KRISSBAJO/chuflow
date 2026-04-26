import { Transform } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsMongoId, IsOptional, IsString, ValidateIf } from 'class-validator';
import { FOLLOW_UP_CONTACT_METHOD_VALUES, FOLLOW_UP_STATUS_VALUES } from '../follow-up.constants';

export class CreateFollowUpDto {
  @ApiProperty()
  @IsMongoId()
  guestId!: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsMongoId()
  assignedTo?: string | null;

  @ApiProperty({ enum: FOLLOW_UP_STATUS_VALUES })
  @IsIn(FOLLOW_UP_STATUS_VALUES)
  status!: string;

  @ApiProperty({ enum: FOLLOW_UP_CONTACT_METHOD_VALUES })
  @IsIn(FOLLOW_UP_CONTACT_METHOD_VALUES)
  contactMethod!: string;

  @ApiProperty()
  @IsString()
  note!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  nextActionDate?: string;
}

export class UpdateFollowUpDto extends PartialType(CreateFollowUpDto) {}
