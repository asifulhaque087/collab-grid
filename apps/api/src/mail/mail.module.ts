import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailerModule } from "@nestjs-modules/mailer";
import { EjsAdapter } from "@nestjs-modules/mailer/adapters/ejs.adapter";
import { MailService } from "@/mail/mail.service";

// Wraps @nestjs-modules/mailer (nodemailer + EJS). SMTP transport + default
// "from" come from env; templates live under ./templates and are copied into
// dist by the nest-cli `assets` config so `join(__dirname, "templates")`
// resolves both in dev and in the built app.
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.getOrThrow<string>("SMTP_HOST"),
          port: config.get<number>("SMTP_PORT", 587),
          secure: config.get<string>("SMTP_SECURE") === "true",
          auth: {
            user: config.get<string>("SMTP_USER"),
            pass: config.get<string>("SMTP_PASS"),
          },
        },
        defaults: {
          from: config.getOrThrow<string>("MAIL_FROM"),
        },
        template: {
          dir: join(__dirname, "templates"),
          adapter: new EjsAdapter(),
          options: { strict: false },
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
