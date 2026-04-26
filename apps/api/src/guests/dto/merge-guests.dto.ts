import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MergeGuestsDto {
  @ApiProperty()
  @IsMongoId()
  sourceGuestId!: string;
}
