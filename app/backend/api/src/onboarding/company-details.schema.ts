import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'company_details', versionKey: false })
export class CompanyDetails {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  companyName!: string;

  @Prop({ trim: true, maxlength: 2048 })
  website?: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  industry!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  businessModel!: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  teamSize!: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  revenueRange!: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  companyStage!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  country!: string;

  @Prop({ trim: true, maxlength: 100 })
  state?: string;

  @Prop({ trim: true, maxlength: 100 })
  city?: string;
}

export const CompanyDetailsSchema = SchemaFactory.createForClass(CompanyDetails);
