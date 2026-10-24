import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type SocialProvider = 'google' | 'microsoft' | 'linkedin';
export type AuthProvider = SocialProvider | 'password';

@Schema({ timestamps: true, collection: 'users', versionKey: false })
export class User {
  @Prop({ required: true, enum: ['google', 'microsoft', 'linkedin', 'password'] })
  provider!: AuthProvider;

  @Prop({ required: true, trim: true })
  providerSubject!: string;

  @Prop({ trim: true, lowercase: true, sparse: true, unique: true })
  email?: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ trim: true, maxlength: 200 })
  name?: string;

  @Prop({ trim: true, maxlength: 100 })
  givenName?: string;

  @Prop({ trim: true, maxlength: 100 })
  familyName?: string;

  @Prop({ trim: true, maxlength: 2048 })
  picture?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ trim: true, maxlength: 35 })
  locale?: string;

  @Prop({ default: false })
  acceptedTerms!: boolean;

  @Prop()
  termsAcceptedAt?: Date;

  @Prop({ trim: true, maxlength: 40 })
  termsVersion?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ provider: 1, providerSubject: 1 }, { unique: true });
