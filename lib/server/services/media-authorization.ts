import 'server-only';

import type { MediaAuthorizationService } from '@/lib/domain';

export const mediaAuthorizationService: MediaAuthorizationService = {
  async canRead(principal, asset) {
    if (asset.visibility === 'public') {
      return true;
    }

    if (
      !principal ||
      principal.accountStatus !== 'active' ||
      principal.sessionSecurityLevel === 'pending'
    ) {
      return false;
    }

    if (principal.role === 'admin') {
      return principal.sessionSecurityLevel === 'mfa';
    }

    return asset.ownerUserId === principal.id;
  },

  async canUpload(principal, visibility) {
    if (
      principal.accountStatus !== 'active' ||
      principal.sessionSecurityLevel === 'pending'
    ) {
      return false;
    }

    return visibility === 'private' || principal.role === 'admin';
  },
};
