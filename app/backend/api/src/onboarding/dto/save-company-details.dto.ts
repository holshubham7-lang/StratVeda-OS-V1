import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

const industries = [
  'Technology', 'Financial Services', 'Healthcare', 'Retail & Ecommerce', 'Manufacturing',
  'Professional Services', 'Education', 'Media & Entertainment', 'Logistics & Transportation',
  'Energy', 'Real Estate', 'Other',
];
const businessModels = [
  'SaaS', 'Services', 'Marketplace', 'Manufacturing', 'Ecommerce', 'Consulting',
  'Agency', 'Subscription', 'Enterprise Software', 'Other',
];
const teamSizes = ['Just me', '2–10', '11–50', '51–200', '201–500', '501–1,000', '1,001–5,000', '5,001+'];
const revenueRanges = ['Pre-revenue', 'Under $100K', '$100K–$500K', '$500K–$1M', '$1M–$5M', '$5M–$20M', '$20M–$100M', '$100M+'];
const companyStages = ['Ideation', 'Validation', 'Early Revenue', 'Growth', 'Scale', 'Enterprise'];

export class SaveCompanyDetailsDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(100)
  companyName!: string;

  @Transform(({ value }) => value === '' ? undefined : value)
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2048)
  website?: string;

  @IsIn(industries)
  industry!: string;

  @Transform(({ value }) => value === '' ? undefined : value)
  @IsOptional()
  @IsIn(businessModels)
  businessModel?: string;

  @IsIn(teamSizes)
  teamSize!: string;

  @IsIn(revenueRanges)
  revenueRange!: string;

  @IsIn(companyStages)
  companyStage!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(100)
  country!: string;

  @IsOptional() @IsString() @MaxLength(100)
  state?: string;

  @IsOptional() @IsString() @MaxLength(100)
  city?: string;
}
