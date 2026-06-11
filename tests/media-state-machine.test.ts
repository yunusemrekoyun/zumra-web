import { describe, expect, it } from 'vitest';
import {
  assertMediaTransition,
  canTransitionMedia,
} from '@/lib/server/media/state-machine';
import {
  UnsafeMediaError,
  UnsupportedMediaTypeError,
} from '@/lib/server/http/errors';
import { parseByteRange } from '@/lib/server/media/range';
import { apiErrorResponse } from '@/lib/server/http/api-errors';
import {
  thumbnailArgs,
  videoArgs,
} from '@/lib/server/media/sandbox';

describe('media state machine', () => {
  it('accepts the safe processing path', () => {
    expect(canTransitionMedia('uploading', 'uploaded')).toBe(true);
    expect(canTransitionMedia('uploaded', 'scanning')).toBe(true);
    expect(canTransitionMedia('scanning', 'processing')).toBe(true);
    expect(canTransitionMedia('processing', 'ready')).toBe(true);
  });

  it('rejects publishing before scanning', () => {
    expect(canTransitionMedia('uploading', 'ready')).toBe(false);
    expect(() => assertMediaTransition('uploading', 'ready')).toThrow(
      'Invalid media transition',
    );
  });
});

describe('video processing policy', () => {
  it('strips metadata and non-media streams from normalized videos', () => {
    const args = videoArgs('/tmp/input.mov', '/tmp/output.mp4');

    expect(args).toContain('-map_metadata');
    expect(args).toContain('-sn');
    expect(args).toContain('-dn');
    expect(args).toContain('+faststart');
  });

  it('uses a bounded seek point for short-video thumbnails', () => {
    expect(thumbnailArgs('/tmp/input.mp4', '/tmp/thumb.jpg', 0.25)).toContain(
      '0.250',
    );
  });
});

describe('parseByteRange', () => {
  it('supports standard and suffix byte ranges', () => {
    expect(parseByteRange('bytes=10-19', 100)).toEqual({
      end: 19,
      start: 10,
    });
    expect(parseByteRange('bytes=-20', 100)).toEqual({
      end: 99,
      start: 80,
    });
  });

  it('rejects malformed and unsatisfiable ranges', () => {
    expect(parseByteRange('bytes=120-130', 100)).toEqual({ invalid: true });
    expect(parseByteRange('bytes=-0', 100)).toEqual({ invalid: true });
    expect(parseByteRange('items=0-10', 100)).toEqual({ invalid: true });
  });
});

describe('media API errors', () => {
  it('returns a controlled response for unsupported file contents', async () => {
    const response = apiErrorResponse(
      new UnsupportedMediaTypeError(),
      'media-test-request',
    );

    expect(response.status).toBe(415);
    expect(response.headers.get('x-request-id')).toBe('media-test-request');
    await expect(response.json()).resolves.toEqual({
      error: 'unsupported_media_type',
    });
  });

  it('does not expose malware scan details to the client', async () => {
    const response = apiErrorResponse(
      new UnsafeMediaError(),
      'malware-test-request',
    );

    expect(response.status).toBe(422);
    expect(response.headers.get('x-request-id')).toBe('malware-test-request');
    await expect(response.json()).resolves.toEqual({
      error: 'upload_rejected',
    });
  });
});
