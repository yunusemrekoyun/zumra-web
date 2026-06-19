import 'server-only';

import nodemailer from 'nodemailer';
import { getMailEnv } from '@/lib/server/env';

const env = getMailEnv();

export const mailTransport = nodemailer.createTransport({
  auth:
    env.SMTP_RELAY_USER && env.SMTP_RELAY_PASSWORD
      ? {
          pass: env.SMTP_RELAY_PASSWORD,
          user: env.SMTP_RELAY_USER,
        }
      : undefined,
  host: env.SMTP_HOST,
  pool: true,
  port: env.SMTP_PORT,
  requireTLS: env.SMTP_REQUIRE_TLS,
  secure: env.SMTP_SECURE,
});

export async function verifyMailTransport() {
  return mailTransport.verify();
}
