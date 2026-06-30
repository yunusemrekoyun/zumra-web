import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';
import { getMailEnv } from '@/lib/server/env';
import type { MailMode } from '@/lib/server/services/settings';

let liveTransport: Transporter | undefined;
let testTransport: Transporter | undefined;

function buildLiveTransport(): Transporter {
  const env = getMailEnv();
  return nodemailer.createTransport({
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
}

function buildTestTransport(): Transporter {
  const env = getMailEnv();
  // Mailpit accepts any sender/recipient and needs no auth or TLS.
  return nodemailer.createTransport({
    host: env.SMTP_TEST_HOST,
    ignoreTLS: true,
    pool: true,
    port: env.SMTP_TEST_PORT,
    secure: false,
  });
}

/**
 * Returns the SMTP transport for the given mode. Two pooled transports are
 * cached so switching modes at runtime never rebuilds connections needlessly.
 * - live: real relay (Gmail/SMTP) → delivers to real addresses.
 * - test: Mailpit sink → captured, never delivered (read in the Mailpit UI).
 */
export function getMailTransport(mode: MailMode): Transporter {
  if (mode === 'test') {
    testTransport ??= buildTestTransport();
    return testTransport;
  }

  liveTransport ??= buildLiveTransport();
  return liveTransport;
}

export async function verifyMailTransport(mode: MailMode = 'live') {
  return getMailTransport(mode).verify();
}
