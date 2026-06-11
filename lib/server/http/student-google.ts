import 'server-only';

import { NextResponse } from 'next/server';
import type { WorkspacePrincipal } from '@/lib/domain';
import { getSessionPrincipal } from '@/lib/server/authorization';

export async function getStudentPrincipalOrNotFound(options?: {
  allowPending?: boolean;
}): Promise<
  WorkspacePrincipal | NextResponse
> {
  const principal = await getSessionPrincipal();

  if (
    !principal ||
    principal.role !== 'student' ||
    principal.accountStatus !== 'active' ||
    (!options?.allowPending &&
      principal.sessionSecurityLevel === 'pending')
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return principal;
}

export function isNotFoundResponse(
  value: WorkspacePrincipal | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
