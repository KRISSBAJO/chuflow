import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class CustodyBag {
  @Prop({ required: true }) label!: string;
  @Prop({ required: true }) seal!: string;
  @Prop({ required: true }) collector!: string;
  @Prop({ required: true }) issuedBy!: string;
  @Prop({ required: true }) issuedAt!: Date;
  @Prop() receivedBy?: string;
  @Prop() receivedAt?: Date;
}

@Schema({ _id: false })
export class CustodyCount {
  @Prop({ required: true }) minor!: number;
  @Prop({ required: true }) by!: string;
  @Prop({ required: true }) at!: Date;
}

@Schema({ _id: false })
export class CustodyDeposit {
  @Prop({ required: true }) reference!: string;
  @Prop({ required: true }) date!: string;
  @Prop({ required: true }) minor!: number;
  @Prop({ required: true }) by!: string;
  @Prop({ required: true }) at!: Date;
}

@Schema({ _id: false })
export class OfferingCustody {
  @Prop({ required: true }) revision!: number;
  @Prop({ required: true }) currency!: string;
  @Prop({ type: [SchemaFactory.createForClass(CustodyBag)], default: [] }) bags!: CustodyBag[];
  @Prop({ type: SchemaFactory.createForClass(CustodyCount) }) first?: CustodyCount;
  @Prop({ type: SchemaFactory.createForClass(CustodyCount) }) second?: CustodyCount;
  @Prop({ type: [SchemaFactory.createForClass(CustodyCount)], default: [] }) mismatches!: CustodyCount[];
  @Prop({ type: SchemaFactory.createForClass(CustodyDeposit) }) deposit?: CustodyDeposit;
}

export const OfferingCustodySchema = SchemaFactory.createForClass(OfferingCustody);
