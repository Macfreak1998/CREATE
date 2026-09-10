import nodemailer, { type Transporter } from "nodemailer";
import { config } from "./config.js";
import { logger } from "./logger.js";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:
      config.SMTP_USER && config.SMTP_PASSWORD
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
  });
  return cachedTransporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Fire-and-forget tauglich: niemals werfen, alle Fehler werden geloggt.
// Aufrufer koennen das Promise gefahrlos `void`-en.
export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await sendMailStrict(message);
  } catch (err) {
    logger.error(
      { err, to: message.to, subject: message.subject },
      "Mail-Versand fehlgeschlagen"
    );
  }
}

/** Wie sendMail, wirft aber bei SMTP-Fehlern (fuer Admin-Testversand). */
export async function sendMailStrict(message: MailMessage): Promise<void> {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: config.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  logger.debug(
    { messageId: info.messageId, to: message.to, subject: message.subject },
    "Mail versendet"
  );
}
