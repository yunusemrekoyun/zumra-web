/**
 * Demo seed — builds a believable academy from scratch so the demo feels
 * lived-in: admin + teachers + programs/branches + students (full enrollment
 * chain) + ~1 year of lessons / attendance / assignments / grades per student.
 *
 * Idempotent at the top level: if the `admin` user already exists it assumes the
 * demo is seeded and exits without touching anything. Everything runs in one
 * transaction, so a failure rolls back cleanly. Demo/dev only.
 *
 *   ALLOW_DEMO_SEED=true node dist/seed-demo.cjs                          (image)
 *   node --conditions=react-server --import tsx scripts/db/seed-demo.ts   (local)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  assignmentSubmissions,
  assignments,
  candidateProfiles,
  contacts,
  enrollmentDrafts,
  enrollments,
  instructorProfiles,
  lessonAttendanceRecords,
  lessonSessions,
  programBranches,
  programs,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD ?? '';
const TZ = 'Europe/Istanbul';
const day = 24 * 60 * 60 * 1000;
const HOUR = 18;

function weeksAgo(n: number): Date {
  const d = new Date(Date.now() - n * 7 * day);
  d.setHours(HOUR, 0, 0, 0);
  return d;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Deterministic attendance mix, shifted per student so classmates differ.
function attendanceStatus(i: number): 'present' | 'late' | 'absent' | 'excused' {
  if (i % 17 === 5) return 'excused';
  if (i % 10 === 9) return 'absent';
  if (i % 5 === 3) return 'late';
  return 'present';
}

const HOMEWORK_TITLES = [
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
const MATERIAL_TITLES = [
  'Ders notları: Zamanlar',
  'Faydalı kalıplar PDF',
  'Telaffuz rehberi',
];

const TEACHERS = [
  { name: 'Elif Demir', username: 'elifhoca', email: 'elif@zumra.local', phone: '05321110001', specialty: 'İngilizce' },
  { name: 'Zeynep Kaya', username: 'zeynephoca', email: 'zeynep@zumra.local', phone: '05321110002', specialty: 'İngilizce' },
  { name: 'Merve Şahin', username: 'mervehoca', email: 'merve@zumra.local', phone: '05321110003', specialty: 'Almanca' },
];

const PROGRAMS = [
  { name: 'İngilizce Başlangıç (A1–A2)', language: 'İngilizce', levels: ['A1', 'A2'], price: 1_200_000, popular: true },
  { name: 'İngilizce Orta (B1–B2)', language: 'İngilizce', levels: ['B1', 'B2'], price: 1_500_000, popular: false },
  { name: 'Almanca Başlangıç (A1)', language: 'Almanca', levels: ['A1'], price: 1_300_000, popular: false },
  { name: 'İngilizce Konuşma Kulübü', language: 'İngilizce', levels: ['B1', 'B2'], price: 800_000, popular: true },
];

// program index, branch name, teacher index, lesson weeks
const BRANCHES = [
  { program: 0, name: 'A1–A2 Sabah Grubu', teacher: 0, weeks: 48 },
  { program: 0, name: 'A1–A2 Akşam Grubu', teacher: 1, weeks: 36 },
  { program: 1, name: 'B1–B2 Hafta İçi', teacher: 1, weeks: 40 },
  { program: 2, name: 'Almanca A1 Grubu', teacher: 2, weeks: 32 },
  { program: 3, name: 'Konuşma Kulübü', teacher: 0, weeks: 24 },
];

const STUDENTS = [
  { name: 'Ayşe Yılmaz', username: 'ayseyilmaz', branch: 0, level: 'A2' },
  { name: 'Fatma Demir', username: 'fatmademir', branch: 0, level: 'A1' },
  { name: 'Zehra Aydın', username: 'zehraaydin', branch: 2, level: 'B1' },
  { name: 'Hatice Şahin', username: 'haticesahin', branch: 3, level: 'A1' },
  { name: 'Büşra Arslan', username: 'busraarslan', branch: 4, level: 'B2' },
  { name: 'Merve Yıldız', username: 'merveyildiz', branch: 1, level: 'A2' },
  { name: 'Sıla Koç', username: 'silakoc', branch: 1, level: 'A1' },
];

void (async () => {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DEMO_SEED !== 'true'
  ) {
    console.error(
      '[seed-demo] production ortamında engellendi. Demo verisi için ' +
        'ALLOW_DEMO_SEED=true ile çalıştır (yalnız DEMO DB!).',
    );
    process.exit(1);
  }

  if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
    console.error(
      '[seed-demo] DEMO_SEED_PASSWORD gerekli (en az 8 karakter). ' +
        'Örn: -e DEMO_SEED_PASSWORD="***REMOVED***."',
    );
    process.exit(1);
  }

  const [existingAdmin] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  if (existingAdmin) {
    console.log('[seed-demo] "admin" zaten var — demo seedli kabul edildi, çıkılıyor.');
    process.exit(0);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await database.transaction(async (tx) => {
    const newUser = async (
      name: string,
      email: string,
      username: string,
      role: 'admin' | 'teacher' | 'student',
    ): Promise<string> => {
      const id = randomUUID();
      await tx.insert(users).values({
        id,
        name,
        email,
        emailVerified: true,
        username,
        displayUsername: username,
        role,
        accountStatus: 'active',
      });
      await tx.insert(accounts).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: passwordHash,
      });
      return id;
    };

    // --- admin ---
    const adminId = await newUser('Zümra Admin', 'admin@zumra.local', 'admin', 'admin');

    // --- teachers (user + instructor profile) ---
    const teacherUserIds: string[] = [];
    const instructorProfileIds: string[] = [];
    for (const t of TEACHERS) {
      const uid = await newUser(t.name, t.email, t.username, 'teacher');
      const [first, ...rest] = t.name.split(' ');
      const [prof] = await tx
        .insert(instructorProfiles)
        .values({
          userId: uid,
          firstName: first,
          lastName: rest.join(' ') || first,
          email: t.email,
          phone: t.phone,
          status: 'active',
          specialties: [t.specialty],
          createdByUserId: adminId,
        })
        .returning({ id: instructorProfiles.id });
      teacherUserIds.push(uid);
      instructorProfileIds.push(prof.id);
    }

    // --- programs ---
    const programIds: string[] = [];
    for (let i = 0; i < PROGRAMS.length; i += 1) {
      const p = PROGRAMS[i];
      const [row] = await tx
        .insert(programs)
        .values({
          name: p.name,
          description: `${p.language} ${p.levels.join('–')} seviyesi grup programı.`,
          kind: 'group',
          language: p.language,
          levels: p.levels,
          listPriceCents: p.price,
          currency: 'TRY',
          active: true,
          publicVisible: true,
          displayOrder: i + 1,
          popular: p.popular,
          createdByUserId: adminId,
        })
        .returning({ id: programs.id });
      programIds.push(row.id);
    }

    // --- branches + per-branch lessons & assignments ---
    type BranchData = {
      branchId: string;
      instructorProfileId: string;
      teacherUserId: string;
      lessons: { id: string; startsAt: Date; endsAt: Date }[];
      homework: { id: string; dueAt: Date; maxScore: number }[];
    };
    const branchData: BranchData[] = [];

    let lessonTotal = 0;
    let homeworkTotal = 0;
    let materialTotal = 0;

    for (const b of BRANCHES) {
      const instructorProfileId = instructorProfileIds[b.teacher];
      const teacherUserId = teacherUserIds[b.teacher];
      const [branch] = await tx
        .insert(programBranches)
        .values({
          programId: programIds[b.program],
          name: b.name,
          status: 'in_progress',
          plannedStartDate: ymd(weeksAgo(b.weeks)),
          plannedEndDate: ymd(new Date(Date.now() + 8 * 7 * day)),
          timezone: TZ,
          minimumCapacity: 1,
          maximumCapacity: 12,
          instructorProfileId,
          createdByUserId: adminId,
        })
        .returning({ id: programBranches.id });

      // weekly completed lessons
      const lessons: BranchData['lessons'] = [];
      for (let i = 0; i < b.weeks; i += 1) {
        const startsAt = weeksAgo(b.weeks - i);
        const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);
        const [lesson] = await tx
          .insert(lessonSessions)
          .values({
            source: 'branch',
            branchId: branch.id,
            instructorProfileId,
            startsAt,
            endsAt,
            timezone: TZ,
            status: 'completed',
            changeNote: '[seed-demo]',
            createdByUserId: adminId,
            createdAt: startsAt,
            updatedAt: startsAt,
          })
          .returning({ id: lessonSessions.id });
        lessons.push({ id: lesson.id, startsAt, endsAt });
        lessonTotal += 1;
      }

      // homework (~ every 3 weeks) + a few materials
      const homework: BranchData['homework'] = [];
      const slotCount = Math.min(HOMEWORK_TITLES.length, Math.floor(b.weeks / 3));
      for (let k = 0; k < slotCount; k += 1) {
        const weekIndex = Math.min(b.weeks - 2, 2 + k * 3);
        const createdAt = weeksAgo(b.weeks - weekIndex);
        const dueAt = new Date(createdAt.getTime() + 7 * day);
        const maxScore = k % 5 === 4 ? 50 : 100;
        const [a] = await tx
          .insert(assignments)
          .values({
            instructorProfileId,
            title: HOMEWORK_TITLES[k],
            description: 'Demo ödev.',
            requiresSubmission: true,
            maxScore,
            dueAt,
            targetType: 'branch',
            targetBranchId: branch.id,
            createdByUserId: adminId,
            createdAt,
            updatedAt: createdAt,
          })
          .returning({ id: assignments.id });
        homework.push({ id: a.id, dueAt, maxScore });
        homeworkTotal += 1;
      }
      for (let m = 0; m < MATERIAL_TITLES.length; m += 1) {
        const createdAt = weeksAgo(Math.max(1, b.weeks - (5 + m * 8)));
        await tx.insert(assignments).values({
          instructorProfileId,
          title: MATERIAL_TITLES[m],
          description: 'Demo materyal.',
          requiresSubmission: false,
          maxScore: null,
          targetType: 'branch',
          targetBranchId: branch.id,
          createdByUserId: adminId,
          createdAt,
          updatedAt: createdAt,
        });
        materialTotal += 1;
      }

      branchData.push({
        branchId: branch.id,
        instructorProfileId,
        teacherUserId,
        lessons,
        homework,
      });
    }

    // --- students: full enrollment chain + per-student progress ---
    let submissionTotal = 0;
    for (let s = 0; s < STUDENTS.length; s += 1) {
      const st = STUDENTS[s];
      const branch = BRANCHES[st.branch];
      const bd = branchData[st.branch];
      const email = `${st.username}@zumra.local`;
      const [first, ...rest] = st.name.split(' ');
      const lastName = rest.join(' ') || first;

      const userId = await newUser(st.name, email, st.username, 'student');
      const [contact] = await tx
        .insert(contacts)
        .values({
          firstName: first,
          lastName,
          email,
          normalizedEmail: email.toLowerCase(),
          phone: `0532222${String(1000 + s).slice(-4)}`,
          city: 'İstanbul',
          learningGoal: PROGRAMS[branch.program].language,
          lessonModel: 'group',
          marketingConsent: true,
        })
        .returning({ id: contacts.id });
      const [candidate] = await tx
        .insert(candidateProfiles)
        .values({ contactId: contact.id, stage: 'enrolled' })
        .returning({ id: candidateProfiles.id });
      const [studentProfile] = await tx
        .insert(studentProfiles)
        .values({
          contactId: contact.id,
          candidateId: candidate.id,
          userId,
          status: 'active',
          currentLevel: st.level,
        })
        .returning({ id: studentProfiles.id });
      const price = PROGRAMS[branch.program].price;
      const [draft] = await tx
        .insert(enrollmentDrafts)
        .values({
          candidateId: candidate.id,
          createdByUserId: adminId,
          status: 'completed',
          currentStep: 9,
          courseMode: 'group',
          programId: programIds[branch.program],
          branchId: bd.branchId,
          finalPriceCents: price,
        })
        .returning({ id: enrollmentDrafts.id });
      await tx.insert(enrollments).values({
        studentId: studentProfile.id,
        candidateId: candidate.id,
        draftId: draft.id,
        registeredByUserId: adminId,
        status: 'active',
        courseMode: 'group',
        programId: programIds[branch.program],
        branchId: bd.branchId,
        finalPriceCents: price,
      });

      // attendance per lesson (offset so classmates differ)
      for (let i = 0; i < bd.lessons.length; i += 1) {
        const lesson = bd.lessons[i];
        const status = attendanceStatus(i + s * 3);
        const present = status === 'present' || status === 'late';
        await tx.insert(lessonAttendanceRecords).values({
          lessonSessionId: lesson.id,
          studentProfileId: studentProfile.id,
          status,
          source: 'teacher',
          totalSeconds: status === 'present' ? 3000 : status === 'late' ? 2400 : 0,
          firstJoinedAt: present ? lesson.startsAt : null,
          lastLeftAt: present ? lesson.endsAt : null,
          confirmedAt: lesson.endsAt,
          confirmedByUserId: bd.teacherUserId,
          createdAt: lesson.endsAt,
          updatedAt: lesson.endsAt,
        });
      }

      // graded submissions with an improving trend (skip last = active, plus one)
      for (let k = 0; k < bd.homework.length; k += 1) {
        if (k === bd.homework.length - 1 || k === Math.floor(bd.homework.length / 2)) {
          continue;
        }
        const hw = bd.homework[k];
        const late = (k + s) % 7 === 5;
        const submittedAt = new Date(hw.dueAt.getTime() + (late ? day : -2 * day));
        const ratio = k / Math.max(1, bd.homework.length);
        const base = 55 + ratio * 36 + ((s % 3) - 1) * 4;
        const score = Math.max(
          0,
          Math.min(hw.maxScore, Math.round((base / 100) * hw.maxScore)),
        );
        await tx.insert(assignmentSubmissions).values({
          assignmentId: hw.id,
          studentProfileId: studentProfile.id,
          body: 'Demo teslim.',
          status: 'graded',
          isLate: late,
          submittedAt,
          score,
          feedback: score >= hw.maxScore * 0.85 ? 'Çok iyi!' : 'Gelişiyorsun.',
          gradedAt: new Date(submittedAt.getTime() + 2 * day),
          gradedByUserId: bd.teacherUserId,
          createdAt: submittedAt,
          updatedAt: submittedAt,
        });
        submissionTotal += 1;
      }
    }

    console.log('✅ Demo akademi oluşturuldu:');
    console.log(`   admin: 1 · öğretmen: ${TEACHERS.length} · öğrenci: ${STUDENTS.length}`);
    console.log(`   program: ${PROGRAMS.length} · şube: ${BRANCHES.length}`);
    console.log(`   ders: ${lessonTotal} · ödev: ${homeworkTotal} · materyal: ${materialTotal} · teslim: ${submissionTotal}`);
    console.log('   girişler: admin / elifhoca / ayseyilmaz ... (şifre: DEMO_SEED_PASSWORD)');
  });

  process.exit(0);
})();
