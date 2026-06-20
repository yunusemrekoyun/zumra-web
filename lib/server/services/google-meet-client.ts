import 'server-only';

import { createSign } from 'node:crypto';
import { z } from 'zod';
import { getGoogleMeetEnv } from '@/lib/server/env';

export const GOOGLE_MEET_SCOPE =
  'https://www.googleapis.com/auth/meetings.space.created';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MEET_API_BASE_URL = 'https://meet.googleapis.com/v2';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().default(3600),
  token_type: z.string().optional(),
});

const meetSpaceSchema = z.object({
  meetingCode: z.string().min(1),
  meetingUri: z.string().url(),
  name: z.string().min(1),
});

const conferenceRecordSchema = z.object({
  endTime: z.string().optional(),
  name: z.string().min(1),
  // Google Meet v2 returns `space` as the space resource name string
  // (e.g. "spaces/abc"), not a nested object. We don't read it, so accept any.
  space: z.unknown().optional(),
  startTime: z.string().optional(),
});

const participantSchema = z.object({
  anonymousUser: z
    .object({
      displayName: z.string().optional(),
    })
    .optional(),
  earliestStartTime: z.string().optional(),
  latestEndTime: z.string().optional(),
  name: z.string().min(1),
  phoneUser: z
    .object({
      displayName: z.string().optional(),
    })
    .optional(),
  signedinUser: z
    .object({
      displayName: z.string().optional(),
      user: z.string().optional(),
    })
    .optional(),
});

const participantSessionSchema = z.object({
  endTime: z.string().optional(),
  name: z.string().min(1),
  startTime: z.string().min(1),
});

type AccessTokenCache = {
  accessToken: string;
  expiresAt: number;
  key: string;
};

const globalForGoogleMeet = globalThis as unknown as {
  zumraGoogleMeetToken?: AccessTokenCache;
};

export type GoogleMeetSpace = z.infer<typeof meetSpaceSchema>;
export type GoogleMeetConferenceRecord = z.infer<
  typeof conferenceRecordSchema
>;
export type GoogleMeetParticipant = z.infer<typeof participantSchema>;
export type GoogleMeetParticipantSession = z.infer<
  typeof participantSessionSchema
>;

export class GoogleMeetClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GoogleMeetClientError';
  }
}

export function isGoogleMeetEnabled() {
  return getGoogleMeetEnv().GOOGLE_MEET_ENABLED;
}

export async function createGoogleMeetSpace(): Promise<GoogleMeetSpace> {
  return googleMeetFetch('/spaces', {
    body: JSON.stringify({
      config: {
        accessType: 'OPEN',
        entryPointAccess: 'ALL',
      },
    }),
    method: 'POST',
  }, meetSpaceSchema);
}

// Ends the current conference in a space, ejecting all live participants.
// Throws (FAILED_PRECONDITION) when there is no active conference — callers
// treat that as a benign no-op.
export async function endGoogleMeetConference(spaceName: string): Promise<void> {
  await googleMeetFetch(
    `/${spaceName}:endActiveConference`,
    { body: JSON.stringify({}), method: 'POST' },
    z.unknown(),
  );
}

// Locks a space down to RESTRICTED so the raw meet.google.com link no longer
// auto-admits anyone (non-invitees must knock). Used to close access after a
// lesson is cancelled/completed/auto-closed.
export async function lockGoogleMeetSpace(spaceName: string): Promise<void> {
  await googleMeetFetch(
    `/${spaceName}?${new URLSearchParams({ updateMask: 'config.accessType' })}`,
    {
      body: JSON.stringify({ config: { accessType: 'RESTRICTED' } }),
      method: 'PATCH',
    },
    z.unknown(),
  );
}

export async function listGoogleMeetConferenceRecords(input: {
  endedAfter?: Date;
  spaceName: string;
  startedBefore?: Date;
}) {
  const filters = [`space.name = "${input.spaceName}"`];

  if (input.endedAfter) {
    filters.push(`end_time >= "${input.endedAfter.toISOString()}"`);
  }

  if (input.startedBefore) {
    filters.push(`start_time <= "${input.startedBefore.toISOString()}"`);
  }

  return googleMeetList({
    itemKey: 'conferenceRecords',
    path: `/conferenceRecords?${new URLSearchParams({
      filter: filters.join(' AND '),
      pageSize: '100',
    })}`,
    schema: conferenceRecordSchema,
  });
}

export async function listGoogleMeetParticipants(conferenceRecordName: string) {
  return googleMeetList({
    itemKey: 'participants',
    path: `/${conferenceRecordName}/participants?${new URLSearchParams({
      pageSize: '250',
    })}`,
    schema: participantSchema,
  });
}

export async function listGoogleMeetParticipantSessions(
  participantName: string,
) {
  return googleMeetList({
    itemKey: 'participantSessions',
    path: `/${participantName}/participantSessions?${new URLSearchParams({
      pageSize: '250',
    })}`,
    schema: participantSessionSchema,
  });
}

export async function getGoogleMeetAccessToken() {
  const env = getGoogleMeetEnv();

  if (!env.GOOGLE_MEET_ENABLED) {
    throw new GoogleMeetClientError('Google Meet integration is disabled.');
  }

  const key = [
    env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    env.GOOGLE_MEET_IMPERSONATED_USER,
    GOOGLE_MEET_SCOPE,
  ].join(':');
  const cached = globalForGoogleMeet.zumraGoogleMeetToken;

  if (cached?.key === key && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const assertion = createServiceAccountAssertion({
    clientEmail: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL!,
    impersonatedUser: env.GOOGLE_MEET_IMPERSONATED_USER!,
    privateKey: normalizePrivateKey(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!),
    scope: GOOGLE_MEET_SCOPE,
  });
  const response = await fetch(TOKEN_URL, {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new GoogleMeetClientError(
      `Google token request failed with ${response.status}.`,
      response.status,
    );
  }

  const token = tokenResponseSchema.parse(await response.json());
  globalForGoogleMeet.zumraGoogleMeetToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    key,
  };

  return token.access_token;
}

export function createServiceAccountAssertion(input: {
  clientEmail: string;
  impersonatedUser: string;
  privateKey: string;
  scope: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64UrlJson({
    alg: 'RS256',
    typ: 'JWT',
  });
  const encodedClaims = base64UrlJson({
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
    iss: input.clientEmail,
    scope: input.scope,
    sub: input.impersonatedUser,
  });
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .end()
    .sign(input.privateKey)
    .toString('base64url');

  return `${unsigned}.${signature}`;
}

async function googleMeetFetch<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
) {
  const accessToken = await getGoogleMeetAccessToken();
  const response = await fetch(`${MEET_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new GoogleMeetClientError(
      `Google Meet request failed with ${response.status}.`,
      response.status,
    );
  }

  return schema.parse(await response.json());
}

async function googleMeetList<T>(input: {
  itemKey: string;
  path: string;
  schema: z.ZodType<T>;
}) {
  const result: T[] = [];
  let nextPageToken: string | undefined;

  do {
    const separator = input.path.includes('?') ? '&' : '?';
    const path = nextPageToken
      ? `${input.path}${separator}${new URLSearchParams({
          pageToken: nextPageToken,
        })}`
      : input.path;
    const response = await googleMeetFetch(
      path,
      { method: 'GET' },
      z.object({
        nextPageToken: z.string().optional(),
      }).catchall(z.unknown()),
    );
    const items = z.array(input.schema).default([]).parse(response[input.itemKey]);

    result.push(...items);
    nextPageToken = response.nextPageToken;
  } while (nextPageToken);

  return result;
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function normalizePrivateKey(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\(\r?\n)/g, '$1');
}
