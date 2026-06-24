import { IsArray, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
