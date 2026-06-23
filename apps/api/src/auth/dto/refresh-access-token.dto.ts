import { IsString } from "class-validator";

export class RefreshAccessTokenDto {
  @IsString()
  token!: string;
}
