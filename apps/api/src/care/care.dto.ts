import {
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CARE_OUTCOMES, CARE_STAGES } from './care.policy';
export class CareListDto {
  @IsOptional() @Matches(/^\d+$/) limit?: string;
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional()
  @IsIn([
    'today',
    'overdue',
    'unassigned',
    'escalated',
    'retention',
    'all',
    'mine',
  ])
  view?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Matches(/^\d+$/) page?: string;
}
export class CareChangeDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsIn([
    'assign',
    'preferences',
    'note',
    'contact',
    'task',
    'complete',
    'handover',
    'accept',
    'decline',
    'journey',
    'enroll',
    'pause',
    'resume',
    'retry_messages',
  ])
  operation!: string;
  @IsOptional() @IsMongoId() userId?: string | null;
  @IsOptional() @IsMongoId() backupId?: string | null;
  @IsOptional() @IsMongoId() taskId?: string;
  @IsOptional() @IsMongoId() serviceUnitId?: string;
  @IsOptional() @IsString() @MaxLength(5000) note?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsIn(CARE_OUTCOMES) outcome?: string;
  @IsOptional()
  @IsIn(['phone', 'email', 'whatsapp', 'text', 'in_person', 'administrative'])
  method?: string;
  @IsOptional() @IsIn(['team', 'pastoral']) visibility?: string;
  @IsOptional() @IsDateString() nextActionAt?: string;
  @IsOptional() @IsDateString() until?: string;
  @IsOptional() @IsIn(CARE_STAGES) stage?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  emailAllowed?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  stopContact?: boolean;
  @IsOptional() @IsIn(['en', 'es']) language?: string;
}
export class CarePlanDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsBoolean() enabled!: boolean;
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  teamIds!: string[];
  @IsOptional() @IsMongoId() leaderId?: string;
  @IsOptional() @IsObject() unavailableUntil?: Record<string, string>;
  @IsInt() @Min(1) @Max(168) firstContactHours!: number;
  @IsInt() @Min(1) @Max(336) retryHours!: number;
  @IsInt() @Min(1) @Max(10) maxAttempts!: number;
  @IsInt() @Min(1) @Max(336) escalationHours!: number;
  @IsInt() @Min(1) @Max(500) capacity!: number;
  @IsBoolean() emailEnabled!: boolean;
  @IsInt() @Min(1) @Max(5) maxAutomatedMessages!: number;
  @IsString() @MaxLength(100) timeZone!: string;
  @IsInt() @Min(0) @Max(23) quietStart!: number;
  @IsInt() @Min(0) @Max(23) quietEnd!: number;
  @IsString() @MinLength(2) @MaxLength(200) subject!: string;
  @IsString() @MinLength(10) @MaxLength(3000) message!: string;
  @IsString() @MinLength(2) @MaxLength(200) subjectEs!: string;
  @IsString() @MinLength(10) @MaxLength(3000) messageEs!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  retentionEmailEnabled?: boolean;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  retentionSubject?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  retentionMessage?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  retentionSubjectEs?: string;
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  retentionMessageEs?: string;
  @IsBoolean() attendanceReliable!: boolean;
  @IsOptional() @IsDateString() coverageFrom?: string;
  @IsInt() @Min(7) @Max(180) absenceDays!: number;
  @IsInt() @Min(3) @Max(30) minAttendanceRecords!: number;
  @IsBoolean() weeklyDigest!: boolean;
}
export class CarePublicDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  stopContact?: boolean;
  @IsBoolean() contactRequested!: boolean;
  @IsIn(['well', 'away', 'request_call', 'prayer', 'moved', 'other'])
  response!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsDateString() until?: string;
  @IsIn(['en', 'es']) language!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  emailAllowed?: boolean;
}
