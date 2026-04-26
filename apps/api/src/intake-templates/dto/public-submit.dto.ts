import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class PublicTemplateSubmitDto {
  @ApiProperty({ additionalProperties: true })
  @IsObject()
  answers!: Record<string, unknown>;
}
