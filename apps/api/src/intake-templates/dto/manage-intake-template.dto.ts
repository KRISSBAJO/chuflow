import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class IntakeTemplateFieldDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

class IntakeTemplateThemeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  darkColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  softColor?: string;
}

export class CreateIntakeTemplateDto {
  @ApiProperty({ enum: ['guest', 'member', 'attendance'] })
  @IsIn(['guest', 'member', 'attendance'])
  kind!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  introTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  introBody?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  closingText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submitLabel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  successTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  successMessage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoPath?: string;

  @ApiProperty({ type: IntakeTemplateThemeDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntakeTemplateThemeDto)
  theme?: IntakeTemplateThemeDto;

  @ApiProperty({ type: [IntakeTemplateFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntakeTemplateFieldDto)
  fields!: IntakeTemplateFieldDto[];
}

export class UpdateIntakeTemplateDto extends PartialType(CreateIntakeTemplateDto) {}

export class CreateBranchOverrideDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  branchId?: string;
}
