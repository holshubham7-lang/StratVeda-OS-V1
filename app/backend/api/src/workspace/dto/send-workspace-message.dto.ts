import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendWorkspaceMessageDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2, { message: 'Ask a question of at least a few words.' }) @MaxLength(4000)
  message!: string;

  /** Evidence file ids attached to this turn; the agent reads their stored text. */
  @IsOptional()
  @IsArray() @ArrayMaxSize(5, { message: 'Attach no more than 5 files to one question.' })
  @IsMongoId({ each: true, message: 'One of the attached files is no longer in your library.' })
  attachmentIds?: string[];
}
