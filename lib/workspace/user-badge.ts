import type { WorkspacePrincipal } from '@/lib/domain';

export type WorkspaceUserBadgeOverride = {
  handle: string;
  initials: string;
  name: string;
};

/**
 * Real signed-in user for the header badge — replaces the static manifest mock.
 * Initials match the Avatar component (first letters of the first two words).
 */
export function userBadgeFromPrincipal(
  principal: WorkspacePrincipal,
): WorkspaceUserBadgeOverride {
  const name = principal.name?.trim() || principal.email;
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  return {
    handle: `@${principal.email.split('@')[0]}`,
    initials,
    name,
  };
}
