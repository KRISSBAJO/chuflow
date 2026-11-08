import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

import { FormAnswersDto } from '../../guests/form-answers.dto';

export class CreateMemberDto extends FormAnswersDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  serviceUnitIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  serviceUnitNames?: string[];

  @ApiProperty()
  @IsMongoId()
  branchId!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  familyDetails?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  membershipStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateJoinedChurch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  believerFoundationClassStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bccStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lccStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lcdStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  holySpiritBaptismStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  waterBaptismStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  serviceUnitInterest?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  guestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  serviceUnitId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  believerFoundationClassDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  believerFoundationClassLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bccDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bccLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lccDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lccLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lcdDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lcdLocation?: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
