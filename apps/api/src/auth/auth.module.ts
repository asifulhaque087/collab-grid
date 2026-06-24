import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import ms from 'ms';
import { MailModule } from '@/mail/mail.module';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { AccessTokenGuard } from '@/auth/guards/access-token.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { QuotaGuard } from '@/auth/guards/quota.guard';
import { GoogleStrategy } from '@/auth/strategies/google.strategy';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';

@Module({
  imports: [
    MailModule,
    PassportModule,
    // Access-token defaults; refresh tokens override secret/expiry at sign time.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'ACCESS_TOKEN_EXPIRATION',
          ) as ms.StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    AccessTokenGuard,
    PermissionsGuard,
    QuotaGuard,
  ],
  exports: [AuthService, AccessTokenGuard, PermissionsGuard, QuotaGuard],
})
export class AuthModule {}
