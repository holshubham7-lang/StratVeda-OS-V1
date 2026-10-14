import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const strategicObjectives = [
  'Revenue Growth', 'Profitability', 'Market Expansion', 'Fundraising',
  'Operational Efficiency', 'Customer Retention', 'Product Growth', 'Risk Reduction',
] as const;

export const strategicConstraints = [
  'Too Many Priorities', 'Leadership Misalignment', 'Slow Decision Making', 'Resource Allocation',
  'Customer Churn', 'Revenue Predictability', 'Operational Bottlenecks', 'Lack Of Visibility',
] as const;

@Schema({ timestamps: true, collection: 'strategic_contexts', versionKey: false })
export class StrategicContext {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: strategicObjectives, maxlength: 100 })
  primaryObjective!: string;

  @Prop({ required: true, enum: strategicConstraints, maxlength: 100 })
  biggestConstraint!: string;

  @Prop({ required: true, trim: true, minlength: 20, maxlength: 500 })
  successDefinition!: string;

  @Prop({ required: true, trim: true, minlength: 20, maxlength: 500 })
  whyNow!: string;
}

export const StrategicContextSchema = SchemaFactory.createForClass(StrategicContext);
