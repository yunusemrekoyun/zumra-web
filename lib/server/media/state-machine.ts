import type { MediaStatus } from '@/lib/domain';

const transitions: Record<MediaStatus, MediaStatus[]> = {
  uploading: ['uploaded', 'failed'],
  uploaded: ['scanning', 'failed'],
  scanning: ['processing', 'ready', 'failed', 'quarantined'],
  processing: ['ready', 'failed', 'quarantined'],
  ready: [],
  failed: ['scanning', 'processing'],
  quarantined: [],
};

export function canTransitionMedia(
  current: MediaStatus,
  next: MediaStatus,
) {
  return transitions[current].includes(next);
}

export function assertMediaTransition(
  current: MediaStatus,
  next: MediaStatus,
) {
  if (!canTransitionMedia(current, next)) {
    throw new Error(`Invalid media transition: ${current} -> ${next}`);
  }
}
