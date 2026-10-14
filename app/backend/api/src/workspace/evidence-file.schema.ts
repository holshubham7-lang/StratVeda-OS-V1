import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * A file the customer actually uploaded, kept beside the decision workspace.
 * `evidence_items` still holds the descriptor the onboarding step edits, so this
 * document owns only what the library cannot: where the bytes are and, for
 * text-readable types, the content the agent is allowed to quote.
 */
@Schema({ timestamps: true, collection: 'evidence_files', versionKey: false })
export class EvidenceFile {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  name!: string;

  @Prop({ required: true, min: 1 })
  size!: number;

  @Prop({ required: true, trim: true, maxlength: 120 })
  mimeType!: string;

  /** Server-generated `<uuid>.<ext>`; the original name is never used as a path. */
  @Prop({ required: true, trim: true, maxlength: 255 })
  storedAs!: string;

  @Prop({ trim: true, maxlength: 20000 })
  text?: string;

  @Prop({ type: Boolean, default: false })
  textTruncated!: boolean;

  @Prop({ type: Date })
  createdAt?: Date;
}

export const EvidenceFileSchema = SchemaFactory.createForClass(EvidenceFile);
EvidenceFileSchema.index({ userId: 1, createdAt: -1 });
