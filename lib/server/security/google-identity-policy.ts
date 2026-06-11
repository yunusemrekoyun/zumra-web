import type { WorkspacePrincipal } from '@/lib/domain';

export const googleProviderSecurityPolicy = {
  accessType: 'online',
  disableImplicitSignUp: true,
  disableSignUp: true,
} as const;

export const googleAccountSecurityPolicy = {
  allowDifferentEmails: false,
  allowUnlinkingAll: false,
  disableImplicitLinking: true,
  enabled: true,
  updateUserInfoOnLink: false,
} as const;

export const googleOAuthScopes = ['openid', 'email', 'profile'] as const;

export function canManageGoogleIdentity(principal: WorkspacePrincipal) {
  return (
    principal.role === 'student' &&
    principal.accountStatus === 'active' &&
    principal.sessionSecurityLevel !== 'pending'
  );
}
