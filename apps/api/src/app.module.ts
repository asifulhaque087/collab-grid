
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { AuthModule } from '@/auth/auth.module';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { RoleModule } from '@/roles/role.module';
import { PackageModule } from '@/packages/package.module';
import { BoardModule } from '@/boards/board.module';
import { InventoryModule } from '@/inventory/inventory.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { OrderModule } from '@/orders/order.module';
import { UserModule } from '@/users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        CLIENT_URL: Joi.string().required(),
        CORS_ORIGIN: Joi.string().required(),
        PORT: Joi.number().default(3001),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        SMTP_SECURE: Joi.boolean().required(),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        MAIL_FROM: Joi.string().required(),
        RESET_TOKEN_EXPIRATION: Joi.string().required(),
        RESET_PASSWORD_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        RABBITMQ_URL: Joi.string().required(),
        WS_TOKEN_SECRET: Joi.string().required(),
      }),
    }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    AuthModule,
    RoleModule,
    UserModule,
    PackageModule,
    BoardModule,
    InventoryModule,
    SubscriptionModule,
    RealtimeModule,
    OrderModule,
  ],
})
export class AppModule {}
