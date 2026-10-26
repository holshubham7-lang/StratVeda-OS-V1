import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  dataIntakeAgentStatuses,
  dataIntakeExtensions,
  dataIntakeFileStatuses,
  dataIntakeSessionStatuses,
  maxDataIntakeFileSize,
  maxDataIntakeTextChars,
  DataIntakeAgentStatus,
  DataIntakeFileStatus,
  DataIntakeSessionStatus,
} from './data-intake.constants';

@Schema({ timestamps: true, collection: 'data_intake_files', versionKey: false })
export class DataIntakeFile {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  name!: string;

  @Prop({ required: true, min: 1, max: maxDataIntakeFileSize })
  size!: number;

  @Prop({ required: true, trim: true, maxlength: 120 })
  mimeType!: string;

  @Prop({ required: true, enum: dataIntakeExtensions, maxlength: 10 })
  extension!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  quarantineBlob!: string;

  @Prop({ trim: true, maxlength: 255 })
  cleanBlob?: string;

  @Prop({ required: true, enum: dataIntakeFileStatuses, default: 'quarantined' })
  status!: DataIntakeFileStatus;

  @Prop({ trim: true, maxlength: 200 })
  scanResult?: string;

  @Prop({ type: Date })
  scanCheckedAt?: Date;

  @Prop({ trim: true, maxlength: maxDataIntakeTextChars })
  text?: string;

  @Prop({ type: Boolean, default: false })
  textTruncated!: boolean;

  @Prop({ type: Boolean, default: false })
  promptShieldFlagged!: boolean;

  @Prop({ type: Number, default: 0 })
  attempts!: number;

  @Prop({ trim: true, maxlength: 1000 })
  error?: string;

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;
}

export const DataIntakeFileSchema = SchemaFactory.createForClass(DataIntakeFile);
DataIntakeFileSchema.index({ userId: 1, createdAt: 1 });
DataIntakeFileSchema.index({ status: 1, createdAt: 1 });

@Schema({ timestamps: true, collection: 'data_intake_sessions', versionKey: false })
export class DataIntakeSession {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: dataIntakeSessionStatuses, default: 'processing' })
  status!: DataIntakeSessionStatus;

  @Prop({ required: true, enum: dataIntakeAgentStatuses, default: 'pending' })
  dataAgentStatus!: DataIntakeAgentStatus;

  @Prop({ required: true, enum: dataIntakeAgentStatuses, default: 'pending' })
  masterStatus!: DataIntakeAgentStatus;

  @Prop({ type: Boolean, default: false })
  handoverRequested!: boolean;

  @Prop({ type: Number, default: 0 })
  generation!: number;

  @Prop({ trim: true, maxlength: 50000 })
  evidencePackageText?: string;

  @Prop({ trim: true, maxlength: 12000 })
  masterResponse?: string;

  @Prop({ trim: true, maxlength: 1000 })
  error?: string;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;
}

export const DataIntakeSessionSchema = SchemaFactory.createForClass(DataIntakeSession);
