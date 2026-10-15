import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const decisionDomainOptions = [
  'Strategy', 'Revenue Growth', 'Sales', 'Marketing', 'Pricing', 'Finance',
  'Operations', 'Customer Success', 'Hiring', 'Product', 'Investments',
] as const;

export const decisionFrequencyOptions = ['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const;

@Schema({ timestamps: true, collection: 'decision_profiles', versionKey: false })
export class DecisionProfile {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: [String],
    required: true,
    enum: decisionDomainOptions,
    validate: {
      validator(this: DecisionProfile) {
        // Update validators also run when this field is untouched, so a missing
        // array must not throw; `required` is what enforces presence.
        if (!Array.isArray(this.decisionDomains)) return true;
        return this.decisionDomains.length >= 3;
      },
      message: 'Choose at least 3 decision domains.',
    },
  })
  decisionDomains!: string[];

  @Prop({ required: true, enum: decisionFrequencyOptions, maxlength: 30 })
  decisionFrequency!: string;

  @Prop({ required: true, trim: true, minlength: 20, maxlength: 500 })
  importantDecision!: string;
}

export const DecisionProfileSchema = SchemaFactory.createForClass(DecisionProfile);
