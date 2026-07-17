import { Controller, Get } from '@nestjs/common';
import { PackageService } from './package.service';

@Controller('packages')
export class PublicPackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get('public')
  findPublic() {
    return this.packageService.findPublicPackages();
  }
}
