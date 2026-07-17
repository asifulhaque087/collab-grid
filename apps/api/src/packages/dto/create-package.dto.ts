import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PackagePermissionLimitDto {
  @IsUUID('4')
  permissionId!: string;

  @IsInt()
  @Min(-1)
  limit!: number;
}

export class CreatePackageDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackagePermissionLimitDto)
  permissions!: PackagePermissionLimitDto[];
}
