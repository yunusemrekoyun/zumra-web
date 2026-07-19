import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
import { apiErrorResponse, requestId } from '@/lib/server/http/api-errors';
import { exportPaymentsCsv } from '@/lib/server/services/payments';

const filterSchema = z.object({
  instructorId: z.string().uuid().optional(),
  query: z.string().max(120).optional(),
  status: z.enum(['reported', 'confirmed', 'rejected']).optional(),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    const principal = await requireAdminSession();
    const url = new URL(request.url);
    const parsed = filterSchema.safeParse({
      instructorId: url.searchParams.get('instructorId') ?? undefined,
      query: url.searchParams.get('query') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    const csv = await exportPaymentsCsv(
      principal,
      parsed.success ? parsed.data : {},
    );
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="zumra-odemeler-${today}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Request-ID': id,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
