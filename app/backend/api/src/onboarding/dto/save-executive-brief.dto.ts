import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExecutiveBriefAnswerDto {
  // Questions are product copy that the brief page owns, so they are length-
  // checked rather than enum-checked; only the user's answer carries meaning.
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(300)
  question!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(4000)
  answer!: string;
}

export class SaveExecutiveBriefDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Answer at least one question before continuing.' })
  @ArrayMaxSize(8, { message: 'Answer no more than 8 questions.' })
  @ValidateNested({ each: true })
  @Type(() => ExecutiveBriefAnswerDto)
  answers!: ExecutiveBriefAnswerDto[];
}
