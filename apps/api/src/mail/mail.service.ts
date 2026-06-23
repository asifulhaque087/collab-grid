import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { tryit } from '@collab-grid/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  // Render + send the forgot-password email. Returns whether the send
  // succeeded; the caller deliberately ignores failures so the API response
  // never reveals whether the address maps to a real account.
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
    expiresInMinutes: number,
  ): Promise<boolean> {
    const [, err] = await tryit(
      this.mailerService.sendMail({
        to,
        subject: 'Reset your MyPatient password',
        template: 'forgot-password',
        context: { name, resetUrl, expiresInMinutes },
      }),
    );

    if (err) {
      this.logger.error(`Failed to send password-reset email to ${to}`, err);
      return false;
    }

    return true;
  }
}
