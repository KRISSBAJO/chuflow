import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWorkspaceRequestDto {
  @IsIn(['new', 'in_review', 'approved', 'rejected', 'provisioned'])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNotes?: string;
}
