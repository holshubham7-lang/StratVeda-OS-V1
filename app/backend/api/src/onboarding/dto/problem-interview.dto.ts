import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StartProblemInterviewDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(10) @MaxLength(3000)
  problemStatement!: string;

  @IsOptional() @IsString() @MaxLength(100)
  role?: string;
}

export class ReplyToProblemInterviewDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(4000)
  message!: string;
}
