import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ManualSignupDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(80)
  @Matches(/\S/)
  name!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsBoolean({ message: 'You must accept the Terms & Conditions and Privacy Policy.' })
  @Equals(true, { message: 'You must accept the Terms & Conditions and Privacy Policy.' })
  acceptedTerms!: boolean;
}
