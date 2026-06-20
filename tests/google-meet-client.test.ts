import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnvForTests } from '@/lib/server/env';
import {
  createGoogleMeetSpace,
  createServiceAccountAssertion,
  GOOGLE_MEET_SCOPE,
  getGoogleMeetAccessToken,
  GoogleMeetClientError,
} from '@/lib/server/services/google-meet-client';

describe('google meet client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetServerEnvForTests();
  });

  it('requires full service account configuration when enabled', async () => {
    vi.stubEnv('GOOGLE_MEET_ENABLED', 'true');
    resetServerEnvForTests();

    await expect(getGoogleMeetAccessToken()).rejects.toThrow(
      'Invalid google meet environment variables',
    );
  });

  it('creates a domain-wide delegation JWT assertion', () => {
    const privateKey = createPrivateKey();
    const assertion = createServiceAccountAssertion({
      clientEmail: 'service-account@example.iam.gserviceaccount.com',
      impersonatedUser: 'meet@zumraakademi.example',
      privateKey,
      scope: GOOGLE_MEET_SCOPE,
    });
    const [, encodedClaims] = assertion.split('.');
    const claims = JSON.parse(
      Buffer.from(encodedClaims!, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(claims.iss).toBe(
      'service-account@example.iam.gserviceaccount.com',
    );
    expect(claims.sub).toBe('meet@zumraakademi.example');
    expect(claims.scope).toBe(GOOGLE_MEET_SCOPE);
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
  });

  it('creates an open Meet space with a service-account access token', async () => {
    configureMeetEnv(createPrivateKey());
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return jsonResponse({
            access_token: 'test-access-token',
            expires_in: 3600,
          });
        }

        expect(String(url)).toBe('https://meet.googleapis.com/v2/spaces');
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          authorization: 'Bearer test-access-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          config: {
            accessType: 'OPEN',
            entryPointAccess: 'ALL',
          },
        });

        return jsonResponse({
          meetingCode: 'abc-defg-hij',
          meetingUri: 'https://meet.google.com/abc-defg-hij',
          name: 'spaces/test-space',
        });
      });

    await expect(createGoogleMeetSpace()).resolves.toEqual({
      meetingCode: 'abc-defg-hij',
      meetingUri: 'https://meet.google.com/abc-defg-hij',
      name: 'spaces/test-space',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces Google API failures as client errors', async () => {
    configureMeetEnv(createPrivateKey());
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return jsonResponse({
          access_token: 'test-access-token',
          expires_in: 3600,
        });
      }

      return jsonResponse({ error: 'quota_exceeded' }, 429);
    });

    await expect(createGoogleMeetSpace()).rejects.toBeInstanceOf(
      GoogleMeetClientError,
    );
  });
});

function configureMeetEnv(privateKey: string) {
  vi.stubEnv('GOOGLE_MEET_ENABLED', 'true');
  vi.stubEnv('GOOGLE_MEET_IMPERSONATED_USER', 'meet@zumraakademi.example');
  vi.stubEnv(
    'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL',
    'service-account@example.iam.gserviceaccount.com',
  );
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', privateKey);
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_PROJECT_ID', 'zumra-test');
  resetServerEnvForTests();
}

function createPrivateKey() {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  return privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}
