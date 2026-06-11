import 'server-only';

import type { AuditEvent, AuditService } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { auditLogs } from '@/lib/server/db/schema';
import { maskIp, redactMetadata } from '@/lib/server/security/network';

export const auditService: AuditService = {
  async record(event: AuditEvent) {
    await database.insert(auditLogs).values({
      action: event.action,
      actorUserId: event.actorUserId,
      maskedIp: maskIp(event.ip),
      metadata: redactMetadata(event.metadata),
      requestId: event.requestId,
      result: event.result,
      targetId: event.targetId,
      targetType: event.targetType,
    });
  },
};
