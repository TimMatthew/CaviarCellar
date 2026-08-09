import nodemailer from "nodemailer";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";

// SMTP adapter. Built lazily; if SMTP isn't configured (dev), sends are logged
// and skipped rather than failing. Critically, a mail failure NEVER throws —
// email must not break the money/delivery flow.

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.mail.host) return null;
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
}

export async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t || !to) {
    logger.warn({ to, subject }, "email skipped (SMTP not configured or no recipient)");
    return;
  }
  try {
    await t.sendMail({ from: config.mail.from, to, subject, text });
    logger.info({ to, subject }, "email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "email send failed");
  }
}
