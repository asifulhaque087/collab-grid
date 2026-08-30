import { Controller, Get } from '@nestjs/common';
import { PackageService } from './package.service';

@Controller('packages')
export class PublicPackageController {
  constructor(private readonly packageService: PackageService) {}

  @Get('public')
  findPublic() {
    // console.log("I am from public package get")
    console.log("I am from public package get")
    console.log("I am from public package get")
    return this.packageService.findPublicPackages();
  }
}
