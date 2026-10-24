import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  code!: string;

  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}
