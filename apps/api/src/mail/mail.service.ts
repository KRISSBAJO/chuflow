import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { createHash, randomUUID } from 'crypto';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
}

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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendAppEmail({
    to,
    subject,
    text,
    html,
    idempotencyKey,
  }: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    idempotencyKey?: string;
  }) {
    const from =
      this.configService.get<string>('mailFrom') ?? 'no-reply@church.local';

    if (this.configService.get<string>('mailProvider') === 'relykit') {
      const key = this.configService.get<string>('relykitApiKey');
      if (!key) throw new Error('Email provider is not configured');
      // Callers can reuse a key for retries without suppressing separate, identical messages.
      const requestKey = idempotencyKey ?? randomUUID();
      const response = await fetch('https://api.relykit.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify({ from, to, subject, text, html }),
      });
      // Never expose the provider response: it can contain recipient data or links.
      if (!response.ok)
        throw new Error(
          `Email provider rejected the request (${response.status})`,
        );
      const result = (await response.json()) as {
        id?: string;
        status?: string;
      };
      if (!result.id)
        throw new Error('Email provider returned an invalid response');
      return {
        // Legacy callers use this flag for provider acceptance, not inbox delivery.
        delivered: true,
        accepted: true,
        deliveryStatus: result.status ?? 'queued',
        previewUrl: null,
        messageId: result.id,
      };
    }

    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn('Email transport not configured; message was not sent.');

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

  async sendWelcomeEmail(
    email: string,
    name: string,
    role: string,
    scope: string,
    setupUrl: string,
  ) {
    const safe = {
      name: escapeHtml(name),
      role: escapeHtml(role),
      scope: escapeHtml(scope),
      url: escapeHtml(setupUrl),
    };
    return this.sendAppEmail({
      to: email,
      subject: 'Welcome to ChuFlow — set up your account',
      idempotencyKey:
        'welcome-' +
        createHash('sha256')
          .update(email + setupUrl)
          .digest('hex'),
      text: `Hello ${name},\n\nYour ChuFlow account has been created.\nRole: ${role}\nWorkspace: ${scope}\n\nChoose your password using this private link (expires in 24 hours):\n${setupUrl}\n\nThis link can be used once. Do not forward it. If you were not expecting this account, contact your church administrator.\n\nChuFlow`,
      html: `<div style="background:#f6f5f1;padding:32px 16px;font-family:Arial,sans-serif;color:#171717"><div style="max-width:520px;margin:auto;background:white;border:1px solid #e8e6e1;border-radius:20px;padding:32px"><div style="font-size:25px;font-weight:700">ChuFlow<span style="color:#f47b16">.</span></div><h1 style="font-size:26px;margin-top:32px">Welcome, ${safe.name}</h1><p style="line-height:1.6;color:#555">Your church has created your account. Set your password to get started.</p><div style="padding:18px;background:#f6f5f1;border-radius:12px;line-height:1.8"><strong>Role:</strong> ${safe.role}<br><strong>Workspace:</strong> ${safe.scope}</div><p style="margin:30px 0"><a href="${safe.url}" style="display:inline-block;background:#171717;color:white;padding:15px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Set up my account →</a></p><p style="font-size:13px;line-height:1.6;color:#666">This private link expires in 24 hours and can be used once. Please do not forward it. If you were not expecting this account, contact your church administrator.</p></div></div>`,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    expiresAt: string,
  ) {
    const appName = this.configService.get<string>('appName') ?? 'ChuFlow';
    const result = await this.sendAppEmail({
      to: email,
      subject: `${appName} password reset`,
      idempotencyKey:
        'reset-' +
        createHash('sha256')
          .update(email + resetUrl)
          .digest('hex'),
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
      previewUrl: null,
    };
  }
}
