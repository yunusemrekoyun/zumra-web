import 'server-only';

import { desc } from 'drizzle-orm';
import type { BackupStatusService } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { backupRuns } from '@/lib/server/db/schema';

export const backupStatusService: BackupStatusService = {
  async listRecent(limit = 30) {
    const rows = await database
      .select()
      .from(backupRuns)
      .orderBy(desc(backupRuns.startedAt))
      .limit(Math.min(Math.max(limit, 1), 100));

    return rows.map((row) => ({
      completedAt: row.completedAt?.toISOString(),
      errorSummary: row.errorSummary ?? undefined,
      id: row.id,
      kind: row.kind,
      sizeBytes: row.sizeBytes ?? undefined,
      snapshotId: row.snapshotId ?? undefined,
      startedAt: row.startedAt.toISOString(),
      status: row.status,
    }));
  },
};
