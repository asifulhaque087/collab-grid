import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['restricted', 'public'])
  access?: 'restricted' | 'public';

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxWidth?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxHeight?: number;
}
