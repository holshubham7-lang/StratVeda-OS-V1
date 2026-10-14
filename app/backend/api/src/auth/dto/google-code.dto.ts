import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  code!: string;
}
