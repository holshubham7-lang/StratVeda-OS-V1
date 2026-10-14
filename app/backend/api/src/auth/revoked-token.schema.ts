import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RevokedTokenDocument = HydratedDocument<RevokedToken>;

@Schema({ collection: 'revoked_tokens', timestamps: true, versionKey: false })
export class RevokedToken {
  @Prop({ required: true, unique: true })
  jti!: string;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;
}

export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);
