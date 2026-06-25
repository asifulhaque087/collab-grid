import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['restricted', 'public'])
  access!: 'restricted' | 'public';

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxWidth?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxHeight?: number;
}
