import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const briefGenerationStatuses = ['pending', 'ok', 'failed'] as const;

@Schema({ _id: false })
export class ExecutiveBriefAnswer {
  @Prop({ required: true, trim: true, maxlength: 300 })
  question!: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 4000 })
  answer!: string;
}
export const ExecutiveBriefAnswerSchema = SchemaFactory.createForClass(ExecutiveBriefAnswer);

/**
 * The last model run, kept beside the answers so a reload or a return visit can
 * show the brief without spending another completion.
 */
@Schema({ _id: false })
export class ExecutiveBriefGeneration {
  @Prop({ type: String, required: true, enum: briefGenerationStatuses, default: 'pending' })
  status!: (typeof briefGenerationStatuses)[number];

  @Prop({ trim: true, maxlength: 20000 })
  content?: string;

  @Prop({ trim: true, maxlength: 200 })
  model?: string;

  @Prop({ trim: true, maxlength: 120 })
  responseId?: string;

  @Prop({ trim: true, maxlength: 500 })
  error?: string;

  @Prop({ type: Date })
  generatedAt?: Date;
}
export const ExecutiveBriefGenerationSchema = SchemaFactory.createForClass(ExecutiveBriefGeneration);

@Schema({ timestamps: true, collection: 'executive_briefs', versionKey: false })
export class ExecutiveBrief {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [ExecutiveBriefAnswerSchema], default: [] })
  answers!: ExecutiveBriefAnswer[];

  @Prop({ type: ExecutiveBriefGenerationSchema, default: () => ({ status: 'pending' }) })
  generation!: ExecutiveBriefGeneration;
}

export const ExecutiveBriefSchema = SchemaFactory.createForClass(ExecutiveBrief);
