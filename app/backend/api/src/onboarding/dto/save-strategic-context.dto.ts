import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { strategicConstraints, strategicObjectives } from '../strategic-context.schema';

export class SaveStrategicContextDto {
  @IsIn(strategicObjectives as unknown as string[], { message: 'Choose a primary objective.' })
  primaryObjective!: string;

  @IsIn(strategicConstraints as unknown as string[], { message: 'Choose the biggest constraint.' })
  biggestConstraint!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(20) @MaxLength(500)
  successDefinition!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(20) @MaxLength(500)
  whyNow!: string;
}
