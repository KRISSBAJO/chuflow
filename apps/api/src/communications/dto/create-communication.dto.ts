import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateCommunicationDto {
  @ApiProperty()
  @IsString()
  templateName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  channel!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  guestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiProperty()
  @IsString()
  recipient!: string;

  @ApiProperty()
  @IsString()
  message!: string;
}
