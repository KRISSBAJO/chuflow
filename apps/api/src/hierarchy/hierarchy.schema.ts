import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class HierarchyUnit {
  @Prop({ enum: ['district', 'zone', 'area'], required: true }) kind!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'District',
    required: true,
    index: true,
  })
  districtId!: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'HierarchyUnit', index: true })
  parentId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch' })
  headquartersBranchId?: Types.ObjectId;
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true })
  pastorUserId?: Types.ObjectId;
  @Prop({ default: false }) pastorVisibilityEnabled!: boolean;
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ default: 0 }) revision!: number;
}
export const HierarchyUnitSchema = SchemaFactory.createForClass(HierarchyUnit);
export type HierarchyUnitDocument = HydratedDocument<HierarchyUnit>;

@Schema({ timestamps: true })
export class HierarchyChange {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;
  @Prop({ required: true }) action!: string;
  @Prop({ type: Object, required: true }) details!: Record<string, unknown>;
}
export const HierarchyChangeSchema =
  SchemaFactory.createForClass(HierarchyChange);
