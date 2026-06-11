const BLOCKED_ADMIN_PREFIX = '/api/auth/admin/';
const BLOCKED_ACCOUNT_PATHS = [
  '/account-info',
  '/get-access-token',
  '/link-social',
  '/list-accounts',
  '/refresh-token',
  '/unlink-account',
] as const;

export function isBlockedExternalAuthPath(pathname: string) {
  return (
    pathname.includes(BLOCKED_ADMIN_PREFIX) ||
    pathname.endsWith('/is-username-available') ||
    BLOCKED_ACCOUNT_PATHS.some((path) => pathname.endsWith(path))
  );
}

export function isTwoFactorDisablePath(pathname: string) {
  return pathname.endsWith('/two-factor/disable');
}
