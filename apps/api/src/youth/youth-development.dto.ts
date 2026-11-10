import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

class ActivityTitle {
  @IsString() @Matches(/\S/) @MaxLength(100) title!: string;
}

export class YouthPostDto extends ActivityTitle {
  @IsIn(['update', 'devotional', 'program', 'poll']) kind!: 'update' | 'devotional' | 'program' | 'poll';
  @IsString() @Matches(/\S/) @MaxLength(3000) body!: string;
  @ValidateIf(dto => dto.kind === 'program')
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) sunday?: string;
  @IsOptional() @IsString() @MaxLength(120) scripture?: string;
  @IsOptional() @IsString() @MaxLength(300) question?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true }) @MaxLength(500) resourceUrl?: string;
  @ValidateIf(dto => dto.kind === 'poll')
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(6) @IsString({ each: true }) @Matches(/\S/, { each: true }) @MaxLength(100, { each: true })
  pollOptions?: string[];
}

export class YouthPollVoteDto {
  @IsInt() @Min(0) @Max(5) option!: number;
}

export class YouthChatMessageDto {
  @IsString() @Matches(/\S/) @MaxLength(800) body!: string;
}
export class YouthChatSettingDto {
  @IsBoolean() enabled!: boolean;
}
export class YouthChatReviewDto {
  @IsIn(['approve', 'hide']) action!: 'approve' | 'hide';
}

export class YouthProgramResponseDto {
  @IsString() @Matches(/\S/) @MaxLength(800) answer!: string;
}

export class YouthTrackDto extends ActivityTitle {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(15)
  @IsString({ each: true }) @Matches(/\S/, { each: true }) @MaxLength(100, { each: true })
  milestones!: string[];
}

export class YouthProjectDto extends ActivityTitle {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
  @IsString() @Matches(/\S/) @MaxLength(160) location!: string;
}

export class YouthMentoringDto extends ActivityTitle {
  @IsMongoId() enrollmentId!: string;
  @Equals(true) permissionConfirmed!: true;
}

export class YouthProgressDto {
  @IsMongoId() enrollmentId!: string;
  @IsInt() @Min(0) milestone!: number;
  @IsBoolean() completed!: boolean;
}

export class YouthServiceMinutesDto {
  @IsMongoId() enrollmentId!: string;
  @IsInt() @Min(0) @Max(1440) minutes!: number;
}

export class YouthMentoringCheckInDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
}

export class YouthMentoringReminderDto {
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string | null;
  @IsOptional() @IsString() @MaxLength(180) nextStep?: string;
}

export class YouthRolloutDto {
  @IsBoolean() mentoringEmailEnabled!: boolean;
  @IsBoolean() youthFeedEnabled!: boolean;
}

export class YouthMentoringConsentDto {
  @IsBoolean() enabled!: boolean;
  @IsIn(['en', 'es', 'fr', 'pt']) locale!: 'en' | 'es' | 'fr' | 'pt';
}
