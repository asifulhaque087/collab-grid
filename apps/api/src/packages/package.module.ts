import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PackageController } from './package.controller';
import { PublicPackageController } from './public-package.controller';
import { PackageService } from './package.service';

@Module({
  imports: [AuthModule],
  controllers: [PackageController, PublicPackageController],
  providers: [PackageService],
})
export class PackageModule {}
