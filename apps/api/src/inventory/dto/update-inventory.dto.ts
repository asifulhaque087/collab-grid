import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateInventoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  // `null` detaches the item from its board; a UUID re-attaches it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  boardId?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;
}
