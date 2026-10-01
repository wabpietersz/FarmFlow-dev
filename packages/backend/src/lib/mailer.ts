import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import logger from './logger';

// Create transporter — uses SMTP config from env, falls back to console logging in dev
let transporter: Transporter | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/** Template values copied from .env.example count as "not set up" — Gmail would just reject them. */
function isPlaceholder(value?: string) {
  return !value || /your-email|your-app-password|example\.com|changeme/i.test(value);
}

export function isEmailConfigured() {
  return Boolean(config.smtp?.host && !isPlaceholder(config.smtp?.user) && !isPlaceholder(config.smtp?.pass));
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const smtpHost = config.smtp?.host;
  const smtpPort = config.smtp?.port;
  const smtpUser = config.smtp?.user;
  const smtpPass = config.smtp?.pass;

  if (!isEmailConfigured()) {
    logger.warn('SMTP not configured (missing or placeholder SMTP_USER/SMTP_PASS) — emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort || 587,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const transport = getTransporter();
  const fromAddress = config.smtp?.from || `FarmFlow <noreply@farmflow.com>`;

  if (!transport) {
    // Dev fallback: log email to console
    logger.info('📧 Email (SMTP not configured, logging only)', {
      to: options.to,
      subject: options.subject,
      textPreview: options.text?.substring(0, 200) || 'N/A',
    });
    // Not sent: callers must not tell anyone an email went out.
    return false;
  }

  try {
    await transport.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info('Email sent successfully', { to: options.to, subject: options.subject });
    return true;
  } catch (error) {
    logger.error('Failed to send email', { error, to: options.to });
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  fullName: string,
  resetLink: string,
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1d55b0; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">farmflow</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827; margin-top: 0;">Welcome to FarmFlow, ${escapeHtml(fullName)}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          An account has been created for you on FarmFlow. To get started, please set your password by clicking the button below.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #1d55b0; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Set Your Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #1d55b0; font-size: 13px; word-break: break-all;">
          ${resetLink}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          This link will expire in 1 hour. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `;

  const text = `Welcome to FarmFlow, ${escapeHtml(fullName)}!\n\nAn account has been created for you. Set your password using this link:\n\n${resetLink}\n\nThis link will expire in 1 hour.`;

  return sendEmail({
    to: email,
    subject: 'Welcome to FarmFlow — Set Your Password',
    html,
    text,
  });
}

export async function sendPasswordResetResendEmail(
  email: string,
  fullName: string,
  resetLink: string,
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1d55b0; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">farmflow</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Hi ${escapeHtml(fullName)}, a password reset has been requested for your FarmFlow account. Click the button below to set a new password.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #1d55b0; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Your Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #1d55b0; font-size: 13px; word-break: break-all;">
          ${resetLink}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          This link will expire in 1 hour. If you did not request this reset, you can safely ignore it.
        </p>
      </div>
    </div>
  `;

  const text = `Hi ${escapeHtml(fullName)},\n\nA password reset has been requested for your FarmFlow account.\n\nReset your password using this link:\n\n${resetLink}\n\nThis link will expire in 1 hour.`;

  return sendEmail({
    to: email,
    subject: 'FarmFlow — Password Reset',
    html,
    text,
  });
}
