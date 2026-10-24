import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class MicrosoftCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2048)
  code!: string;

  @IsString()
  @MinLength(43)
  @MaxLength(128)
  codeVerifier!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(256)
  nonce!: string;

  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}
