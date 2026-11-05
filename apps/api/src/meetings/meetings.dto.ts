import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
  Matches,
} from 'class-validator';
export class GroupDto {
  @IsOptional() @IsMongoId() branchId?: string;
  @IsString() @MinLength(2) @MaxLength(150) name!: string;
  @IsOptional() @IsMongoId() serviceUnitId?: string;
  @IsBoolean() enabled!: boolean;
  @IsBoolean() minutesRequired!: boolean;
  @IsInt() @Min(1) @Max(720) minutesDueHours!: number;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  submitterUserIds!: string[];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  reviewerUserIds!: string[];
  @IsOptional() @IsInt() @Min(0) expectedRevision?: number;
}
export class CreateMeetingDto {
  @IsOptional()
  @IsIn(['individuals', 'service_groups', 'church'])
  audienceMode?: 'individuals' | 'service_groups' | 'church';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  audienceServiceUnitIds?: string[];
  @IsOptional() @IsBoolean() sendInvitations?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeMemberIds?: string[];
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsMongoId() groupId?: string;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) agenda?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(300) location?: string;
  @ValidateIf((_, value) => value !== '' && value !== undefined)
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2000)
  joinUrl?: string;
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeUserIds!: string[];
}
export class ActionDto {
  @IsString() @MinLength(1) @MaxLength(100) id!: string;
  @IsString() @MinLength(1) @MaxLength(500) title!: string;
  @IsMongoId() ownerUserId!: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsIn(['open', 'done']) status!: 'open' | 'done';
}
export class UpdateMeetingDto {
  @IsOptional()
  @IsIn(['individuals', 'service_groups', 'church'])
  audienceMode?: 'individuals' | 'service_groups' | 'church';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  audienceServiceUnitIds?: string[];
  @IsOptional() @IsBoolean() sendInvitations?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeMemberIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  presentMemberIds?: string[];
  @IsInt() @Min(0) expectedRevision!: number;
  @IsIn([
    'details',
    'attendance',
    'minutes',
    'submit',
    'approve',
    'return',
    'actions',
  ])
  operation!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) agenda?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() @MaxLength(300) location?: string;
  @ValidateIf((_, value) => value !== '' && value !== undefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  joinUrl?: string;
  @IsOptional()
  @IsIn(['scheduled', 'ongoing', 'completed', 'cancelled'])
  status?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeUserIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsMongoId({ each: true })
  presentUserIds?: string[];
  @IsOptional() @IsString() @MaxLength(50000) minutesBody?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { each: true },
  )
  @MaxLength(2000, { each: true })
  minutesLinks?: string[];
  @IsOptional() @IsString() @MaxLength(2000) reviewComment?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];
}

export class MeetingListDto {
  @IsOptional() @IsString() @MaxLength(150) q?: string;
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsMongoId() groupId?: string;
  @IsOptional()
  @IsIn(['scheduled', 'ongoing', 'completed', 'cancelled'])
  status?: string;
  @IsOptional()
  @IsIn(['draft', 'submitted', 'approved', 'changes_requested', 'overdue'])
  minutes?: string;
  @IsOptional() @IsIn(['newest', 'oldest']) sort?: string;
  @IsOptional() @Matches(/^\d+$/) page?: string;
  @IsOptional() @Matches(/^\d+$/) limit?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['true']) upcoming?: string;
  @IsOptional() @IsIn(['due']) actions?: string;
}
export class MeetingParticipantsDto {
  @IsOptional() @IsIn(['members', 'staff']) kind?: 'members' | 'staff';
  @IsMongoId() branchId!: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Matches(/^\d+$/) page?: string;
}

export class MeetingRevisionDto {
  @IsInt() @Min(0) expectedRevision!: number;
}

export class MeetingAudienceDto {
  @IsOptional() @IsMongoId() branchId?: string;
  @IsOptional() @IsMongoId() groupId?: string;
  @IsOptional() @IsMongoId() meetingId?: string;
  @IsIn(['individuals', 'service_groups', 'church']) audienceMode!:
    | 'individuals'
    | 'service_groups'
    | 'church';
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsMongoId({ each: true })
  audienceServiceUnitIds!: string[];
  @IsArray()
  @ArrayMaxSize(2000)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeMemberIds!: string[];
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsMongoId({ each: true })
  attendeeUserIds!: string[];
}
