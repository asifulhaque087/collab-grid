import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
} from 'class-validator';

export class CreateOrderDto {
  // Client-generated transaction UUID. A repeat submit with the same key is
  // rejected instead of charged again (zero double-spend).
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsUUID()
  boardId!: string;

  // Anonymous canvas user id that holds the reservations.
  @IsString()
  @MinLength(1)
  buyerUserId!: string;

  // Widgets being purchased (the user's reserved/locked items).
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  widgetIds!: string[];

  @IsString()
  @MinLength(1)
  buyerName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  address!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsString()
  @MinLength(1)
  country!: string;

  // Demo card — only the last 4 digits are stored.
  @IsOptional()
  @IsString()
  @Length(4, 4)
  cardLast4?: string;
}
