import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/server/authorization';
import { database } from '@/lib/server/db/client';
import {
  lessonSessions,
  programBranches,
  programs,
} from '@/lib/server/db/schema';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { lessonSessionLocalParts } from '@/lib/server/services/lesson-schedules';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  const url = new URL(request.url);
  const branchId = url.searchParams.get('branchId') ?? '';

  try {
    if (!z.string().uuid().safeParse(branchId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await requireStaffSession();

    const [branch] = await database
      .select({
        name: programBranches.name,
        plannedEndDate: programBranches.plannedEndDate,
        plannedStartDate: programBranches.plannedStartDate,
        programName: programs.name,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .where(eq(programBranches.id, branchId))
      .limit(1);

    if (!branch) {
      return apiResponse({ error: 'not_found' }, 404, id);
    }

    const sessions = await database
      .select({
        endsAt: lessonSessions.endsAt,
        startsAt: lessonSessions.startsAt,
        status: lessonSessions.status,
        timezone: lessonSessions.timezone,
      })
      .from(lessonSessions)
      .where(eq(lessonSessions.branchId, branchId))
      .orderBy(lessonSessions.startsAt);

    // The printable document is Turkish by default; an explicit locale query
    // param can switch the status labels for bilingual callers.
    const localeParam = url.searchParams.get('locale');
    const locale = localeParam === 'en' ? 'en' : 'tr';
    const statusLabels = await getTranslations({
      locale,
      namespace: 'admin.calendar.statuses',
    });

    return new Response(
      renderScheduleHtml(branch, sessions, (status) => statusLabels(status)),
      {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'X-Request-ID': id,
        },
      },
    );
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

function renderScheduleHtml(
  branch: {
    name: string;
    plannedEndDate: string;
    plannedStartDate: string;
    programName: string;
  },
  sessions: Array<{
    endsAt: Date;
    startsAt: Date;
    status: string;
    timezone: string;
  }>,
  statusLabel: (status: string) => string,
) {
  const rows = sessions
    .map((session, index) => {
      const start = lessonSessionLocalParts(session.startsAt, session.timezone);
      const end = lessonSessionLocalParts(session.endsAt, session.timezone);
      return `<tr><td>${index + 1}</td><td>${escapeHtml(start.date)}</td><td>${escapeHtml(start.time)} - ${escapeHtml(end.time)}</td><td>${escapeHtml(statusLabel(session.status))}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(branch.name)} Ders Programı</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #2E286C; margin: 40px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 24px; color: rgba(46,40,108,.65); }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #ece8f3; padding: 12px; text-align: left; }
    th { background: #f8f7fb; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
    .card { background: #f8f7fb; border-radius: 16px; padding: 16px; }
    .label { font-size: 11px; font-weight: 700; color: rgba(46,40,108,.45); text-transform: uppercase; }
    .value { margin-top: 6px; font-weight: 700; }
    @media print { button { display: none; } body { margin: 20mm; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="float:right;padding:10px 16px;border:0;border-radius:12px;background:#533089;color:white;font-weight:700">PDF / Yazdır</button>
  <h1>${escapeHtml(branch.name)}</h1>
  <p>${escapeHtml(branch.programName)} ders programı</p>
  <div class="meta">
    <div class="card"><div class="label">Başlangıç</div><div class="value">${escapeHtml(branch.plannedStartDate)}</div></div>
    <div class="card"><div class="label">Bitiş</div><div class="value">${escapeHtml(branch.plannedEndDate)}</div></div>
    <div class="card"><div class="label">Oturum</div><div class="value">${sessions.length}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Tarih</th><th>Saat</th><th>Durum</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Ders programı henüz oluşturulmamış.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  );
}
