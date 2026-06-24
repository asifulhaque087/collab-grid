import { IsIn, IsString, MinLength } from 'class-validator';

// Gateway integration (SSLCommerz/bKash/Nagad) lands later; for now the handler
// is called directly with the chosen plan, a (demo) transaction id, and how many
// months were purchased.
export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  plan!: string; // plan group slug, e.g. 'pro'

  @IsString()
  @MinLength(1)
  transactionId!: string;

  @IsIn([1, 6, 12, 24])
  durationMonth!: 1 | 6 | 12 | 24;
}
