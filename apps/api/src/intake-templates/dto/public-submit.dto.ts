import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional } from 'class-validator';

export class PublicTemplateSubmitDto {
  @ApiProperty({ additionalProperties: true })
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  formRevision?: number;
}
