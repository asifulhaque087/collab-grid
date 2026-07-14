import { IsString } from 'class-validator';

export class ExchangeDto {
  @IsString()
  boardId!: string;
}
