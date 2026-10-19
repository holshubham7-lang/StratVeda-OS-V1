import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'user_activities', versionKey: false })
export class UserActivity {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['signup', 'login', 'logout'], index: true })
  activity!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ trim: true, maxlength: 64 })
  ipAddress?: string;

  @Prop({ trim: true, maxlength: 120 })
  browser?: string;

  @Prop({ trim: true, maxlength: 120 })
  operatingSystem?: string;

  @Prop({ trim: true, maxlength: 120 })
  devicePlatform?: string;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);
UserActivitySchema.index({ userId: 1, createdAt: -1 });
