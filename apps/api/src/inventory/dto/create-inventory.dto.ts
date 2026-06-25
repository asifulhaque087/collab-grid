import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

// Mirrors the writable columns of smartWidgetTable. posX/posY are intentionally
// omitted — items get coordinates only once dragged onto the canvas.
export class CreateInventoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  sku!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  // Numeric column — accept a numeric string so precision is preserved.
  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  // Attach to a board when created from a board card or the canvas editor.
  @IsOptional()
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;
}
