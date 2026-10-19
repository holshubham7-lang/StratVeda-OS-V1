import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_audit', versionKey: false })
export class AdminAudit {
  @Prop({ required: true, trim: true, lowercase: true })
  actor!: string;

  @Prop({ required: true, enum: ['user.activated', 'user.deactivated'] })
  action!: string;

  @Prop({ type: Types.ObjectId, required: true })
  targetUserId!: Types.ObjectId;

  @Prop({ trim: true, maxlength: 64 })
  ipAddress?: string;
}

export const AdminAuditSchema = SchemaFactory.createForClass(AdminAudit);
AdminAuditSchema.index({ createdAt: -1 });
