import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SocialSignupDto {
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  idToken!: string;

  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;
}
