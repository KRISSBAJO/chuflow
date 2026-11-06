import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(256)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  auth!: string;
}

/** Mirrors the browser's `PushSubscription.toJSON()` shape. */
export class CreatePushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class RemovePushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}

export class ExpoPushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MaxLength(200)
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, {
    message: 'token must be an Expo push token',
  })
  token!: string;
}
