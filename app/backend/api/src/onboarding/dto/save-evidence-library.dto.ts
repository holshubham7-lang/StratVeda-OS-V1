import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  acceptedEvidenceExtensions,
  evidenceCategoryOptions,
  evidenceExtensionMessage,
  evidencePeriodOptions,
  maxEvidenceFileSize,
} from '../evidence-item.schema';

// Derived from the shared list so the DTO, the schema and the picker cannot drift.
const evidenceExtensionPattern = new RegExp(
  `\\.(${acceptedEvidenceExtensions.map((extension) => extension.slice(1)).join('|')})$`,
  'i',
);

export class EvidenceItemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(255)
  @Matches(evidenceExtensionPattern, { message: evidenceExtensionMessage })
  name!: string;

  @IsIn(evidenceCategoryOptions as unknown as string[], { message: 'Choose an evidence category and reporting period.' })
  category!: string;

  @IsIn(evidencePeriodOptions as unknown as string[], { message: 'Choose an evidence category and reporting period.' })
  period!: string;

  @IsInt() @Min(1) @Max(maxEvidenceFileSize)
  size!: number;
}

export class SaveEvidenceLibraryDto {
  // "Skip For Now" is a valid step completion, so an empty list is accepted.
  // 25 keeps a full submission well inside the 16 kB JSON body limit.
  @IsArray()
  @ArrayMaxSize(25, { message: 'Upload no more than 25 evidence files at a time.' })
  @ValidateNested({ each: true })
  @Type(() => EvidenceItemDto)
  items!: EvidenceItemDto[];
}
