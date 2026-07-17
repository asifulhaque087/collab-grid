import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  packageSlug!: string;

  @IsIn([1, 6, 12, 24])
  durationMonth!: 1 | 6 | 12 | 24;
}
