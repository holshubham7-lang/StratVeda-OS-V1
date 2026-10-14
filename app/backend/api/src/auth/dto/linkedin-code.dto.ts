import { IsString, MaxLength, MinLength } from 'class-validator';

export class LinkedInCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  code!: string;
}
