import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const workspaceMessageRoles = ['user', 'assistant'] as const;
export const workspaceReplyStatuses = ['ok', 'failed'] as const;
export const MAX_WORKSPACE_MESSAGES = 60;

@Schema({ _id: false })
export class WorkspaceThreadContext {
  @Prop({ trim: true, maxlength: 120 })
  company?: string;

  @Prop({ trim: true, maxlength: 500 })
  objective?: string;

  @Prop({ trim: true, maxlength: 500 })
  constraint?: string;

  @Prop({ type: [String], default: [] })
  domains!: string[];

  @Prop({ type: Number, default: 0 })
  evidenceCount!: number;

  @Prop({ type: [String], default: [] })
  evidenceNames!: string[];

  @Prop({ type: String, enum: ['pending', 'ok', 'failed'] })
  briefStatus?: 'pending' | 'ok' | 'failed';
}
export const WorkspaceThreadContextSchema = SchemaFactory.createForClass(WorkspaceThreadContext);

@Schema({ _id: false })
export class WorkspaceThreadAttachment {
  @Prop({ required: true, trim: true, maxlength: 255 })
  name!: string;

  @Prop({ required: true, min: 1 })
  size!: number;

  /** False for Word, Excel, PDF and images: their contents never reach the model. */
  @Prop({ type: Boolean, default: false })
  readable!: boolean;
}
export const WorkspaceThreadAttachmentSchema = SchemaFactory.createForClass(WorkspaceThreadAttachment);

@Schema({ _id: false })
export class WorkspaceMessage {
  @Prop({ type: String, required: true, enum: workspaceMessageRoles })
  role!: (typeof workspaceMessageRoles)[number];

  @Prop({ trim: true, maxlength: 20000 })
  content?: string;

  /** Only set on the customer's turn: the files that were in front of the agent. */
  @Prop({ type: [WorkspaceThreadAttachmentSchema], default: [] })
  attachments!: WorkspaceThreadAttachment[];

  /** Only meaningful on an assistant turn: it records what the model actually did. */
  @Prop({ type: String, enum: workspaceReplyStatuses })
  status?: (typeof workspaceReplyStatuses)[number];

  @Prop({ trim: true, maxlength: 200 })
  model?: string;

  @Prop({ trim: true, maxlength: 120 })
  responseId?: string;

  @Prop({ trim: true, maxlength: 500 })
  error?: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;
}
export const WorkspaceMessageSchema = SchemaFactory.createForClass(WorkspaceMessage);

/**
 * One document per conversation, with the exchanges embedded so a question and
 * the answer it produced stay auditable together. `context` is refreshed on
 * every send, so it always describes what the agent was told last.
 */
@Schema({ timestamps: true, collection: 'workspace_threads', versionKey: false })
export class WorkspaceThread {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ type: [WorkspaceMessageSchema], default: [] })
  messages!: WorkspaceMessage[];

  @Prop({ type: WorkspaceThreadContextSchema, default: () => ({ domains: [], evidenceNames: [] }) })
  context!: WorkspaceThreadContext;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const WorkspaceThreadSchema = SchemaFactory.createForClass(WorkspaceThread);
WorkspaceThreadSchema.index({ userId: 1, updatedAt: -1 });
