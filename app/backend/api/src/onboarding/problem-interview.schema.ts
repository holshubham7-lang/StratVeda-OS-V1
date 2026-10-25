import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false, versionKey: false })
export class ProblemInterviewMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true, trim: true, maxlength: 4000 })
  content!: string;

  @Prop({ required: true, default: Date.now })
  createdAt!: Date;
}

export const ProblemInterviewMessageSchema = SchemaFactory.createForClass(ProblemInterviewMessage);

@Schema({ timestamps: true, collection: 'problem_interviews', versionKey: false })
export class ProblemInterview {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 3000 })
  problemStatement!: string;

  @Prop({ required: true, enum: ['pending', 'active', 'complete'], default: 'pending' })
  status!: 'pending' | 'active' | 'complete';

  @Prop({ trim: true })
  responseId?: string;

  @Prop({ trim: true })
  agentSessionId?: string;

  @Prop({ trim: true, maxlength: 4000 })
  pendingMessage?: string;

  @Prop({ type: [ProblemInterviewMessageSchema], default: [] })
  messages!: ProblemInterviewMessage[];
}

export const ProblemInterviewSchema = SchemaFactory.createForClass(ProblemInterview);
