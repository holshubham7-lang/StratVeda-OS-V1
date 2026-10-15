import { Transform } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { decisionDomainOptions, decisionFrequencyOptions } from '../decision-profile.schema';

export class SaveDecisionProfileDto {
  @Transform(({ value }) => Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : item)) : value)
  @IsArray({ message: 'Choose at least 3 decision domains.' })
  @ArrayUnique()
  @ArrayMinSize(3, { message: 'Choose at least 3 decision domains.' })
  @IsIn(decisionDomainOptions as unknown as string[], { each: true, message: 'Choose at least 3 decision domains.' })
  decisionDomains!: string[];

  @IsIn(decisionFrequencyOptions as unknown as string[], { message: 'Choose how often these decisions come up.' })
  decisionFrequency!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(20) @MaxLength(500)
  importantDecision!: string;
}
