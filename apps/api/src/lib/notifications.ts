import { config } from "./config.js";
import { logger } from "./logger.js";
import { sendMail } from "./mailer.js";
import {
  accountCredentialsMail,
  adminFeedbackMail,
  adminPendingCompanyMail,
  companyStatusChangeMail,
} from "./mail-templates.js";
import {
  SETTING_ADMIN_NOTIFICATION_EMAIL,
  getSetting,
} from "./settings.js";

export async function notifyAdminPendingCompany(args: {
  companyId: string;
  companyName: string;
  contactEmail: string;
}): Promise<void> {
  try {
    const recipient = await getSetting(SETTING_ADMIN_NOTIFICATION_EMAIL);
    if (!recipient) {
      logger.debug(
        { companyId: args.companyId },
        "Keine Admin-Notification-Adresse konfiguriert, ueberspringe Mail"
      );
      return;
    }
    const adminLink = `${config.APP_BASE_URL.replace(/\/$/, "")}/admin/firmen/${args.companyId}`;
    await sendMail(
      await adminPendingCompanyMail({
        to: recipient,
        companyName: args.companyName,
        contactEmail: args.contactEmail,
        adminLink,
      })
    );
  } catch (err) {
    logger.error(
      { err, companyId: args.companyId },
      "notifyAdminPendingCompany fehlgeschlagen"
    );
  }
}

export async function notifyCompanyCredentials(args: {
  companyName: string;
  loginEmail: string;
  password: string;
}): Promise<void> {
  try {
    const base = config.APP_BASE_URL.replace(/\/$/, "");
    await sendMail(
      await accountCredentialsMail({
        to: args.loginEmail,
        companyName: args.companyName,
        loginEmail: args.loginEmail,
        password: args.password,
        loginUrl: `${base}/login`,
        profileUrl: `${base}/profil`,
      })
    );
  } catch (err) {
    logger.error(
      { err, loginEmail: args.loginEmail },
      "notifyCompanyCredentials fehlgeschlagen"
    );
  }
}

export async function notifyCompanyStatusChange(args: {
  companyEmail: string;
  companyName: string;
  status: "approved" | "suspended";
}): Promise<void> {
  try {
    const profileUrl = `${config.APP_BASE_URL.replace(/\/$/, "")}/profil`;
    await sendMail(
      await companyStatusChangeMail({
        to: args.companyEmail,
        companyName: args.companyName,
        status: args.status,
        profileUrl,
      })
    );
  } catch (err) {
    logger.error(
      { err, companyEmail: args.companyEmail, status: args.status },
      "notifyCompanyStatusChange fehlgeschlagen"
    );
  }
}

export async function notifyAdminFeedback(args: {
  email: string;
  message: string;
}): Promise<void> {
  try {
    const recipient = await getSetting(SETTING_ADMIN_NOTIFICATION_EMAIL);
    if (!recipient) {
      logger.debug(
        "Keine Admin-Notification-Adresse konfiguriert, ueberspringe Feedback-Mail"
      );
      return;
    }
    const adminLink = `${config.APP_BASE_URL.replace(/\/$/, "")}/admin/feedback`;
    await sendMail(
      await adminFeedbackMail({
        to: recipient,
        email: args.email,
        message: args.message,
        adminLink,
      })
    );
  } catch (err) {
    logger.error({ err }, "notifyAdminFeedback fehlgeschlagen");
  }
}
