import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const evidenceCategoryOptions = [
  'Financial', 'Sales', 'Marketing', 'Operations', 'Customer', 'Strategy', 'Board Reports', 'Other',
] as const;

export const evidencePeriodOptions = [
  'Current Month', 'Current Quarter', 'Last Quarter', 'Current Year', 'Other',
] as const;

// The UI never reads file bytes, so only the descriptor is stored. `size` is
// bounded by the 25 MB per-file ceiling the dropzone enforces.
export const maxEvidenceFileSize = 25 * 1024 * 1024;

/** Word, Excel, CSV, JSON, PDF and the common image formats. */
export const acceptedEvidenceExtensions = [
  '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.pdf', '.jpg', '.jpeg', '.png',
] as const;

export const evidenceFileExtension = (name: string) => `.${(name.split('.').pop() ?? '').toLowerCase()}`;

export const evidenceExtensionMessage =
  'Only Word, Excel, CSV, JSON, PDF, JPG, JPEG or PNG evidence files can be added.';

@Schema({ timestamps: true, collection: 'evidence_items', versionKey: false })
export class EvidenceItem {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
    validate: {
      validator(this: EvidenceItem) {
        // Update validators also run against partial documents, so a name that
        // is not present here must not throw; `required` enforces presence.
        if (typeof this.name !== 'string') return true;
        return acceptedEvidenceExtensions.includes(evidenceFileExtension(this.name) as typeof acceptedEvidenceExtensions[number]);
      },
      message: evidenceExtensionMessage,
    },
  })
  name!: string;

  @Prop({ required: true, min: 1, max: maxEvidenceFileSize })
  size!: number;

  @Prop({ required: true, enum: evidenceCategoryOptions, maxlength: 50 })
  category!: string;

  @Prop({ required: true, enum: evidencePeriodOptions, maxlength: 50 })
  period!: string;
}

export const EvidenceItemSchema = SchemaFactory.createForClass(EvidenceItem);
EvidenceItemSchema.index({ userId: 1, createdAt: -1 });
