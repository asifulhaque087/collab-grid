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

// A single permission granted by a plan, with its quota cap.
// totalOperation: -1 = unlimited, >= 0 = capped quota.
export class PlanPermissionQuotaDto {
  @IsUUID('4')
  permissionId!: string;

  @IsInt()
  @Min(-1)
  totalOperation!: number;
}

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanPermissionQuotaDto)
  permissions!: PlanPermissionQuotaDto[];
}
