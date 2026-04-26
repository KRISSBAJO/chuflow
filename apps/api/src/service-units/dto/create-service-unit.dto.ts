import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateServiceUnitDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  leaderMemberId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  secretaryMemberId?: string;

  @ApiProperty()
  @IsString()
  meetingDay!: string;

  @ApiProperty()
  @IsString()
  prayerDay!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateServiceUnitDto extends PartialType(CreateServiceUnitDto) {}
