import { apiErrorResponse, apiResponse, requestId } from '@/lib/server/http/api-errors';
import {
  getStudentPrincipalOrNotFound,
  isNotFoundResponse,
} from '@/lib/server/http/student-google';
import { googleIdentityService } from '@/lib/server/services/google-identities';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  const principal = await getStudentPrincipalOrNotFound();

  if (isNotFoundResponse(principal)) {
    return principal;
  }

  try {
    const status = await googleIdentityService.getStatus(principal.id);
    return apiResponse(status, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
