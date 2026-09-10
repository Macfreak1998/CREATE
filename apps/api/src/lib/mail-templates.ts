import type { MailMessage } from "./mailer.js";
import {
  SETTING_MAIL_TEMPLATE_PREFIX,
  getSetting,
} from "./settings.js";

export const MAIL_TEMPLATE_KEYS = [
  "password_reset",
  "admin_pending_company",
  "company_approved",
  "company_suspended",
  "account_credentials",
  "admin_feedback",
  "test_mail",
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

export type MailTemplateMeta = {
  key: MailTemplateKey;
  label: string;
  placeholders: string[];
  defaultSubject: string;
  defaultBody: string;
};

export const MAIL_TEMPLATE_META: MailTemplateMeta[] = [
  {
    key: "password_reset",
    label: "Passwort zurücksetzen",
    placeholders: ["code", "link", "validMinutes"],
    defaultSubject: "CREATE: Passwort zuruecksetzen",
    defaultBody:
      `Hallo,\n\n` +
      `du (oder jemand mit Zugriff auf diese E-Mail-Adresse) hat ein neues ` +
      `Passwort fuer die CREATE-Plattform angefordert.\n\n` +
      `Dein Einmal-Code lautet:\n\n` +
      `    {{code}}\n\n` +
      `Alternativ kannst du den folgenden Link oeffnen, der den Code direkt ` +
      `vorausfuellt:\n\n` +
      `{{link}}\n\n` +
      `Der Code ist {{validMinutes}} Minuten gueltig und kann nur einmal ` +
      `verwendet werden. Nach dem Zuruecksetzen werden alle bestehenden ` +
      `Sitzungen abgemeldet.\n\n` +
      `Hast du den Reset nicht angefordert, kannst du diese E-Mail ignorieren.`,
  },
  {
    key: "admin_pending_company",
    label: "Admin: Neues Profil zur Freigabe",
    placeholders: ["companyName", "contactEmail", "adminLink"],
    defaultSubject: "CREATE: Neues Firmenprofil zur Freigabe ({{companyName}})",
    defaultBody:
      `Hallo,\n\n` +
      `auf der CREATE-Plattform liegt ein neues Firmenprofil zur Freigabe vor:\n\n` +
      `    Firma: {{companyName}}\n` +
      `    Kontakt: {{contactEmail}}\n\n` +
      `Du kannst das Profil hier pruefen und freischalten:\n\n` +
      `{{adminLink}}`,
  },
  {
    key: "company_approved",
    label: "Firma: Profil freigeschaltet",
    placeholders: ["companyName", "profileUrl"],
    defaultSubject: 'CREATE: Ihr Profil "{{companyName}}" wurde freigeschaltet',
    defaultBody:
      `Hallo,\n\n` +
      `gute Nachrichten: das Profil von "{{companyName}}" wurde auf der ` +
      `CREATE-Plattform freigeschaltet und ist ab sofort oeffentlich sichtbar.\n\n` +
      `Sie koennen das Profil hier einsehen und bearbeiten:\n\n` +
      `{{profileUrl}}\n\n` +
      `Vielen Dank fuer Ihre Teilnahme am CREATE Match-Making.`,
  },
  {
    key: "company_suspended",
    label: "Firma: Profil abgelehnt",
    placeholders: ["companyName", "profileUrl"],
    defaultSubject: 'CREATE: Ihr Profil "{{companyName}}" wurde abgelehnt',
    defaultBody:
      `Hallo,\n\n` +
      `das Profil von "{{companyName}}" wurde auf der CREATE-Plattform ` +
      `aktuell abgelehnt und ist nicht oeffentlich sichtbar.\n\n` +
      `Sie koennen Ihre Angaben jederzeit anpassen und das Profil zur erneuten ` +
      `Pruefung einreichen:\n\n` +
      `{{profileUrl}}\n\n` +
      `Bei Rueckfragen melden Sie sich bitte beim CREATE-Team.`,
  },
  {
    key: "account_credentials",
    label: "Firma: Zugangsdaten",
    placeholders: [
      "companyName",
      "loginEmail",
      "password",
      "loginUrl",
      "profileUrl",
    ],
    defaultSubject: 'CREATE: Ihre Zugangsdaten fuer "{{companyName}}"',
    defaultBody:
      `Hallo,\n\n` +
      `fuer Ihr Firmenprofil "{{companyName}}" auf der CREATE-Plattform ` +
      `stehen folgende Zugangsdaten bereit:\n\n` +
      `    Login-E-Mail: {{loginEmail}}\n` +
      `    Passwort:     {{password}}\n\n` +
      `Anmelden: {{loginUrl}}\n` +
      `Profil bearbeiten: {{profileUrl}}\n\n` +
      `Bitte aendern Sie Ihr Passwort nach dem ersten Login. ` +
      `Vielen Dank fuer Ihre Teilnahme am CREATE Match-Making.`,
  },
  {
    key: "admin_feedback",
    label: "Admin: Neues Feedback",
    placeholders: ["email", "message", "adminLink"],
    defaultSubject: "CREATE: Neues Feedback eingegangen",
    defaultBody:
      `Hallo,\n\n` +
      `auf der CREATE-Plattform ist ein neues Feedback eingegangen:\n\n` +
      `Absender: {{email}}\n\n` +
      `Nachricht:\n{{message}}\n\n` +
      `Im Admin-Bereich kannst du das Feedback verwalten:\n{{adminLink}}`,
  },
  {
    key: "test_mail",
    label: "SMTP-Test",
    placeholders: ["sentAt"],
    defaultSubject: "CREATE: Test-E-Mail",
    defaultBody:
      `Hallo,\n\n` +
      `dies ist eine Test-E-Mail der CREATE-Plattform.\n\n` +
      `Wenn du diese Nachricht siehst, funktioniert der SMTP-Versand korrekt.\n\n` +
      `Zeitpunkt: {{sentAt}}`,
  },
];

const META_BY_KEY = new Map(MAIL_TEMPLATE_META.map((m) => [m.key, m]));

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/gu, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function mailTemplateSettingKey(
  key: MailTemplateKey,
  field: "subject" | "body"
): string {
  return `${SETTING_MAIL_TEMPLATE_PREFIX}${key}.${field}`;
}

export async function loadMailTemplateContent(
  key: MailTemplateKey
): Promise<{ subject: string; body: string }> {
  const meta = META_BY_KEY.get(key);
  if (!meta) {
    throw new Error(`Unbekanntes Mail-Template: ${key}`);
  }
  const [subject, body] = await Promise.all([
    getSetting(mailTemplateSettingKey(key, "subject")),
    getSetting(mailTemplateSettingKey(key, "body")),
  ]);
  return {
    subject: subject?.trim() || meta.defaultSubject,
    body: body?.trim() || meta.defaultBody,
  };
}

export async function renderMail(args: {
  key: MailTemplateKey;
  to: string;
  vars?: Record<string, string>;
}): Promise<MailMessage> {
  const vars = args.vars ?? {};
  const content = await loadMailTemplateContent(args.key);
  const subject = applyVars(content.subject, vars);
  const text = applyVars(content.body, vars);
  return {
    to: args.to,
    subject,
    text,
    html: textToHtml(text),
  };
}

export async function passwordResetMail(args: {
  to: string;
  code: string;
  link: string;
  validMinutes: number;
}): Promise<MailMessage> {
  return renderMail({
    key: "password_reset",
    to: args.to,
    vars: {
      code: args.code,
      link: args.link,
      validMinutes: String(args.validMinutes),
    },
  });
}

export async function adminPendingCompanyMail(args: {
  to: string;
  companyName: string;
  contactEmail: string;
  adminLink: string;
}): Promise<MailMessage> {
  return renderMail({
    key: "admin_pending_company",
    to: args.to,
    vars: {
      companyName: args.companyName,
      contactEmail: args.contactEmail,
      adminLink: args.adminLink,
    },
  });
}

export async function companyStatusChangeMail(args: {
  to: string;
  companyName: string;
  status: "approved" | "suspended";
  profileUrl: string;
}): Promise<MailMessage> {
  return renderMail({
    key: args.status === "approved" ? "company_approved" : "company_suspended",
    to: args.to,
    vars: {
      companyName: args.companyName,
      profileUrl: args.profileUrl,
    },
  });
}

export async function accountCredentialsMail(args: {
  to: string;
  companyName: string;
  loginEmail: string;
  password: string;
  loginUrl: string;
  profileUrl: string;
}): Promise<MailMessage> {
  return renderMail({
    key: "account_credentials",
    to: args.to,
    vars: {
      companyName: args.companyName,
      loginEmail: args.loginEmail,
      password: args.password,
      loginUrl: args.loginUrl,
      profileUrl: args.profileUrl,
    },
  });
}

export async function adminFeedbackMail(args: {
  to: string;
  email: string;
  message: string;
  adminLink: string;
}): Promise<MailMessage> {
  return renderMail({
    key: "admin_feedback",
    to: args.to,
    vars: {
      email: args.email,
      message: args.message,
      adminLink: args.adminLink,
    },
  });
}

export async function testMail(args: { to: string }): Promise<MailMessage> {
  return renderMail({
    key: "test_mail",
    to: args.to,
    vars: { sentAt: new Date().toISOString() },
  });
}
