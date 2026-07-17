import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PackagePermissionLimitDto } from './create-package.dto';

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackagePermissionLimitDto)
  permissions?: PackagePermissionLimitDto[];
}
