import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WeeklyDistrictPacket {
  @Prop({ required: true }) district!: string;
  @Prop({ required: true }) oversightRegion!: string;
  @Prop({ required: true }) weekEnding!: Date;
  @Prop({ type: [SchemaTypes.ObjectId], required: true })
  branchIds!: Types.ObjectId[];
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;
  @Prop({
    default: 'submitted',
    enum: ['submitted', 'acknowledged', 'returned'],
  })
  status!: string;
  @Prop({ type: SchemaTypes.Mixed, required: true }) snapshot!: Record<
    string,
    unknown
  >;
  @Prop() reviewedAt?: Date;
  @Prop() reviewNote?: string;
}
export const WeeklyDistrictPacketSchema =
  SchemaFactory.createForClass(WeeklyDistrictPacket);
WeeklyDistrictPacketSchema.index({
  district: 1,
  oversightRegion: 1,
  weekEnding: -1,
});
