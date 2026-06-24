/**
 * Demo seed — simulates ~1 year of usage for the existing student/branch/teacher
 * so the progress system has real ground truth and the UI feels lived-in.
 *
 * Idempotent: clears its own prior demo rows (completed branch lessons +
 * branch assignments) before re-inserting. Dev only.
 *
 *   node --conditions=react-server --import tsx scripts/db/seed-demo.ts
 */
import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  assignmentSubmissions,
  assignments,
  enrollments,
  instructorProfiles,
  lessonAttendanceRecords,
  lessonSessions,
  programBranches,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';

const SEED_NOTE = '[seed-demo]';
const WEEKS = 48;
const HOUR = 18;
const day = 24 * 60 * 60 * 1000;

function weeksAgo(n: number): Date {
  const d = new Date(Date.now() - n * 7 * day);
  d.setHours(HOUR, 0, 0, 0);
  return d;
}

// Deterministic attendance mix (~80% present, ~10% late, ~7% absent, ~3% excused).
function attendanceStatus(i: number): 'present' | 'late' | 'absent' | 'excused' {
  if (i % 17 === 5) return 'excused';
  if (i % 10 === 9) return 'absent';
  if (i % 5 === 3) return 'late';
  return 'present';
}

void (async () => {
  // Kazara gerçek prod verisini silmeyi/kirletmeyi önle. Bilerek bir DEMO
  // veritabanına örnek veri yüklemek için ALLOW_DEMO_SEED=true ver.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    console.error(
      '[seed-demo] production ortamında engellendi. Bilerek demo verisi ' +
        'yüklemek için ALLOW_DEMO_SEED=true ile çalıştır (yalnız DEMO DB!).',
    );
    process.exit(1);
  }

  const [fx] = await database
    .select({
      studentProfileId: studentProfiles.id,
      branchId: programBranches.id,
      instructorProfileId: instructorProfiles.id,
      teacherUserId: instructorProfiles.userId,
    })
    .from(enrollments)
    .innerJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, programBranches.instructorProfileId),
    )
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .where(inArray(enrollments.status, ['active', 'paused']))
    .limit(1);

  if (!fx) {
    console.error('Aktif kayıt bulunamadı — seed iptal.');
    process.exit(1);
  }

  const [admin] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);
  const createdBy = admin?.id ?? fx.teacherUserId;
  const teacherUserId = fx.teacherUserId ?? createdBy;
  if (!createdBy) {
    console.error('created_by için kullanıcı yok — seed iptal.');
    process.exit(1);
  }

  // --- idempotency: clear prior demo rows for this branch ---
  const priorLessons = await database
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .where(
      and(
        eq(lessonSessions.branchId, fx.branchId),
        eq(lessonSessions.changeNote, SEED_NOTE),
      ),
    );
  if (priorLessons.length) {
    await database.delete(lessonSessions).where(
      inArray(
        lessonSessions.id,
        priorLessons.map((l) => l.id),
      ),
    ); // cascades attendance
  }
  await database
    .delete(assignments)
    .where(
      and(
        eq(assignments.targetBranchId, fx.branchId),
        eq(assignments.createdByUserId, createdBy),
      ),
    ); // cascades submissions

  // --- 1) weekly completed lessons + attendance ---
  let lessonCount = 0;
  const attendanceTally: Record<string, number> = {};
  for (let i = 0; i < WEEKS; i += 1) {
    const startsAt = weeksAgo(WEEKS - i);
    const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);
    const [lesson] = await database
      .insert(lessonSessions)
      .values({
        source: 'branch',
        branchId: fx.branchId,
        instructorProfileId: fx.instructorProfileId,
        startsAt,
        endsAt,
        timezone: 'Europe/Istanbul',
        status: 'completed',
        changeNote: SEED_NOTE,
        createdByUserId: createdBy,
        createdAt: startsAt,
        updatedAt: startsAt,
      })
      .returning({ id: lessonSessions.id });
    lessonCount += 1;

    const status = attendanceStatus(i);
    attendanceTally[status] = (attendanceTally[status] ?? 0) + 1;
    const present = status === 'present' || status === 'late';
    await database.insert(lessonAttendanceRecords).values({
      lessonSessionId: lesson.id,
      studentProfileId: fx.studentProfileId,
      status,
      source: 'teacher',
      totalSeconds: status === 'present' ? 3000 : status === 'late' ? 2400 : 0,
      firstJoinedAt: present ? startsAt : null,
      lastLeftAt: present ? endsAt : null,
      confirmedAt: endsAt,
      confirmedByUserId: teacherUserId,
      createdAt: endsAt,
      updatedAt: endsAt,
    });
  }

  // --- 2) assignments (homework + materials) with grades that improve over time ---
  const titles = [
    'Present Simple alıştırması',
    'Kelime kartları: Aile',
    'Dinleme: Günlük rutinler',
    'Okuma: Kısa hikaye',
    'Yazma: Kendini tanıt',
    'Present Continuous',
    'Konuşma kulübü hazırlığı',
    'Past Simple alıştırması',
    'Kelime: Yiyecekler',
    'Dilbilgisi tekrarı',
    'Dinleme: Yol tarifi',
    'Yazma: Tatil planı',
    'Future tense',
    'Okuma: Haber metni',
    'Kelime: İş hayatı',
    'Karma tekrar testi',
  ];
  const materialTitles = [
    'Ders notları: Zamanlar',
    'Faydalı kalıplar PDF',
    'Telaffuz rehberi',
  ];

  let homeworkCount = 0;
  let materialCount = 0;
  let submittedCount = 0;
  let gradedCount = 0;
  const scores: number[] = [];

  // ~ every 2-3 weeks an assignment
  const slots = Array.from({ length: titles.length }, (_, k) =>
    Math.min(WEEKS - 2, 2 + k * 3),
  );
  for (let k = 0; k < titles.length; k += 1) {
    const weekIndex = slots[k];
    const createdAt = weeksAgo(WEEKS - weekIndex);
    const dueAt = new Date(createdAt.getTime() + 7 * day);
    const maxScore = k % 5 === 4 ? 50 : 100;
    const [a] = await database
      .insert(assignments)
      .values({
        instructorProfileId: fx.instructorProfileId,
        title: titles[k],
        description: 'Demo ödev.',
        requiresSubmission: true,
        maxScore,
        dueAt,
        targetType: 'branch',
        targetBranchId: fx.branchId,
        createdByUserId: createdBy,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: assignments.id });
    homeworkCount += 1;

    // last one stays unsubmitted (an active assignment); skip a couple to be real
    const isLastActive = k === titles.length - 1;
    const skip = isLastActive || k === 6;
    if (skip) continue;

    const late = k % 7 === 5;
    const submittedAt = new Date(
      dueAt.getTime() + (late ? day : -2 * day),
    );
    // improving trend: ~58 → ~92 over the year + small jitter
    const ratio = weekIndex / WEEKS;
    const base = 58 + ratio * 34 + ((k % 3) - 1) * 4;
    const score = Math.max(0, Math.min(maxScore, Math.round((base / 100) * maxScore)));
    scores.push(Math.round((score / maxScore) * 100));
    await database.insert(assignmentSubmissions).values({
      assignmentId: a.id,
      studentProfileId: fx.studentProfileId,
      body: 'Demo teslim.',
      status: 'graded',
      isLate: late,
      submittedAt,
      score,
      feedback: score >= maxScore * 0.85 ? 'Çok iyi!' : 'Gelişiyorsun.',
      gradedAt: new Date(submittedAt.getTime() + 2 * day),
      gradedByUserId: teacherUserId,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });
    submittedCount += 1;
    gradedCount += 1;
  }

  for (let m = 0; m < materialTitles.length; m += 1) {
    const createdAt = weeksAgo(WEEKS - (5 + m * 12));
    await database.insert(assignments).values({
      instructorProfileId: fx.instructorProfileId,
      title: materialTitles[m],
      description: 'Demo materyal.',
      requiresSubmission: false,
      maxScore: null,
      targetType: 'branch',
      targetBranchId: fx.branchId,
      createdByUserId: createdBy,
      createdAt,
      updatedAt: createdAt,
    });
    materialCount += 1;
  }

  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)
      : 0;
  console.log('✅ Demo seed tamam:');
  console.log(`   dersler: ${lessonCount} (tamamlandı)`);
  console.log(`   yoklama:`, attendanceTally);
  console.log(`   ödev: ${homeworkCount} · materyal: ${materialCount}`);
  console.log(`   teslim/notlandı: ${submittedCount}/${gradedCount}`);
  console.log(
    `   not yüzdesi: ilk ${scores[0]}% → son ${scores[scores.length - 1]}% (ort ${avg}%)`,
  );
  process.exit(0);
})();
