import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private getTransporter() {
    const host = this.configService.get<string>('mailHost');
    const port = this.configService.get<number>('mailPort');
    const secure = this.configService.get<boolean>('mailSecure') ?? false;
    const user = this.configService.get<string>('mailUser');
    const pass = this.configService.get<string>('mailPass');

    if (!host || !port) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendAppEmail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const transporter = this.getTransporter();
    const from = this.configService.get<string>('mailFrom') ?? 'no-reply@church.local';

    if (!transporter) {
      this.logger.warn(`SMTP not configured. Email to ${to} was not sent. Subject: ${subject}`);

      return {
        delivered: false,
        previewUrl: null,
        messageId: null,
      };
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return {
      delivered: true,
      previewUrl: null,
      messageId: info.messageId ?? null,
    };
  }

  async sendPasswordResetEmail(email: string, resetUrl: string, expiresAt: string) {
    const appName = this.configService.get<string>('appName') ?? 'ChuFlow';
    const result = await this.sendAppEmail({
      to: email,
      subject: `${appName} password reset`,
      text: `Reset your password before ${expiresAt}: ${resetUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">Reset your password</h2>
          <p>You requested a password reset for ${appName}.</p>
          <p>This link expires at <strong>${expiresAt}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #0f172a; color: white; padding: 12px 18px; border-radius: 10px; text-decoration: none;">
              Reset password
            </a>
          </p>
        </div>
      `,
    });

    return {
      delivered: result.delivered,
      previewUrl: result.delivered ? null : resetUrl,
    };
  }
}
