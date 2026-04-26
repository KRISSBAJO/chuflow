import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateFinanceLockDto {
  @ApiProperty()
  @IsMongoId()
  branchId!: string;

  @ApiProperty()
  @IsString()
  periodKey!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
