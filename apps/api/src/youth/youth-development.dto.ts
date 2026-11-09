import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

class ActivityTitle {
  @IsString() @Matches(/\S/) @MaxLength(100) title!: string;
}

export class YouthPostDto extends ActivityTitle {
  @IsIn(['update', 'devotional']) kind!: 'update' | 'devotional';
  @IsString() @Matches(/\S/) @MaxLength(3000) body!: string;
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
