import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database, databasePool } from '@/lib/server/db/client';
import {
  privateLessonStudentRates,
  programs,
  users,
} from '@/lib/server/db/schema';
import {
  createProgram,
  PRIVATE_LESSON_PROGRAM_ID,
  resolveProgramPricing,
  setPrivateLessonStudentRate,
  updateProgram,
} from '@/lib/server/services/programs';

const integration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

afterAll(async () => {
  await databasePool.end();
});

integration('program catalog and private lesson student pricing', () => {
  it('keeps catalog prices and private lesson rates historically stable', async () => {
    const marker = randomUUID();
    const adminId = `program-admin-${marker}`;
    const teacherId = `program-teacher-${marker}`;
    let programId: string | undefined;
    const rateIds: string[] = [];

    const principal: WorkspacePrincipal = {
      accountStatus: 'active',
      email: `program-admin-${marker}@example.invalid`,
      id: adminId,
      name: 'Program Admin',
      role: 'admin',
      sessionCreatedAt: new Date().toISOString(),
      sessionId: randomUUID(),
      sessionLastVerifiedAt: new Date().toISOString(),
      sessionSecurityLevel: 'mfa',
      twoFactorEnabled: true,
    };

    try {
      await database.insert(users).values([
        {
          accountStatus: 'active',
          email: principal.email,
          emailVerified: true,
          id: adminId,
          name: principal.name,
          role: 'admin',
          twoFactorEnabled: true,
        },
        {
          accountStatus: 'active',
          email: `program-teacher-${marker}@example.invalid`,
          emailVerified: true,
          id: teacherId,
          name: 'Program Teacher',
          role: 'teacher',
        },
      ]);

      const program = await createProgram(principal, {
        active: true,
        description: 'Integration program',
        language: 'english',
        levels: ['A1', 'A2', 'B1'],
        listPriceCents: 125_000,
        name: 'Integration Group Program',
      });
      programId = program!.id;

      await updateProgram(principal, programId, {
        active: true,
        description: 'Updated integration program',
        language: 'english',
        levels: ['A1', 'A2', 'B1'],
        listPriceCents: 130_000,
        name: 'Integration Group Program',
      });

      const groupPricing = await database.transaction((transaction) =>
        resolveProgramPricing(transaction, { programId: programId! }),
      );
      expect(groupPricing.basePriceCents).toBe(130_000);
      expect(groupPricing.snapshot.levels).toEqual(['A1', 'A2', 'B1']);

      const firstRate = await setPrivateLessonStudentRate(principal, {
        hourlyPriceCents: 2_000,
        language: 'english',
        teacherUserId: teacherId,
      });
      rateIds.push(firstRate!.id);

      const secondRate = await setPrivateLessonStudentRate(principal, {
        hourlyPriceCents: 2_500,
        language: 'english',
        teacherUserId: teacherId,
      });
      rateIds.push(secondRate!.id);

      const privatePricing = await database.transaction((transaction) =>
        resolveProgramPricing(transaction, {
          privateLessonHours: 12,
          privateLessonLanguage: 'english',
          programId: PRIVATE_LESSON_PROGRAM_ID,
          teacherUserId: teacherId,
        }),
      );
      expect(privatePricing.basePriceCents).toBe(30_000);
      expect(privatePricing.snapshot.hourlyStudentPriceCents).toBe(2_500);
      expect(privatePricing.snapshot.teacherName).toBe('Program Teacher');

      const currentRates = await database
        .select()
        .from(privateLessonStudentRates)
        .where(
          and(
            eq(privateLessonStudentRates.teacherUserId, teacherId),
            eq(privateLessonStudentRates.language, 'english'),
            eq(privateLessonStudentRates.active, true),
            isNull(privateLessonStudentRates.effectiveUntil),
          ),
        );
      expect(currentRates).toHaveLength(1);
      expect(currentRates[0]?.id).toBe(secondRate!.id);
    } finally {
      if (rateIds.length) {
        await database
          .delete(privateLessonStudentRates)
          .where(eq(privateLessonStudentRates.teacherUserId, teacherId));
      }
      if (programId) {
        await database.delete(programs).where(eq(programs.id, programId));
      }
      await database.delete(users).where(eq(users.id, teacherId));
      await database.delete(users).where(eq(users.id, adminId));
    }
  });
});
