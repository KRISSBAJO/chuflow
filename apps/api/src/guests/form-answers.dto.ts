import { IsInt, IsObject, IsOptional } from 'class-validator';

export class FormAnswersDto {
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  formRevision?: number;
}
