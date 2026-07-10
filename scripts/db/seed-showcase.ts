/**
 * Showcase seed — layers "the new features have been used" on top of an
 * already-seeded demo DB (seed-demo.ts must have run first). Adds: a live
 * candidate pipeline with consultation appointments in every state, a private
 * (birebir) enrollment + lessons, cancelled/postponed lesson examples,
 * lesson-linked assignments with a pending submission, real chat threads,
 * unread bell notifications, published legal pages and ready Meet links.
 *
 * Idempotent: exits if the showcase marker inquiry already exists. Additive —
 * never resets users/sessions, safe to run on a live demo after deploy.
 *
 *   node --conditions=react-server --import tsx scripts/db/seed-showcase.ts
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, asc, eq, gte, inArray, like, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  advisorTasks,
  appointmentPreferences,
  appointmentRequests,
  assessmentAttempts,
  assessments,
  assessmentVersions,
  assignments,
  assignmentSubmissions,
  candidateActivities,
  candidateConsents,
  candidateInquiries,
  candidateNotes,
  candidateProfiles,
  contacts,
  conversations,
  enrollmentDrafts,
  enrollments,
  instructorProfiles,
  legalPages,
  lessonAttendanceRecords,
  lessonSessionMeetings,
  lessonSessions,
  messages,
  notifications,
  privateLessonStudentRates,
  programBranches,
  programs,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';

const MARKER = 'showcase-elif-kaya-1';
const TZ = 'Europe/Istanbul';
const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

// Istanbul is fixed UTC+3 (no DST) — wall clock helpers anchored to "today".
const now = new Date();
function istToday(hours: number, minutes = 0): Date {
  const istNow = new Date(now.getTime() + 3 * hour);
  return new Date(
    Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate(),
      hours - 3,
      minutes,
    ),
  );
}
const istDay = (dayOffset: number, hours: number, minutes = 0) =>
  new Date(istToday(hours, minutes).getTime() + dayOffset * day);

// Believable-looking (but fake) Meet coordinates derived from the session id.
function fakeMeet(sessionId: string) {
  const letters = sessionId
    .replace(/-/g, '')
    .split('')
    .map((c) => 'abcdefghijklmnopqrstuvwxyz'[parseInt(c, 16) % 26])
    .join('');
  const code = `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7, 10)}`;
  return {
    meetingCode: code,
    meetingUri: `https://meet.google.com/${code}`,
    spaceName: `spaces/${letters.slice(0, 12)}`,
  };
}

const CONSENT_SNAPSHOT =
  'Zümra Akademi tarafından kişisel verilerimin 6698 sayılı KVKK kapsamında, ' +
  'eğitim danışmanlığı hizmeti sunulması amacıyla işlenmesini kabul ediyorum.';
const MARKETING_SNAPSHOT =
  'Zümra Akademi kampanya ve duyurularının e-posta ile tarafıma iletilmesine onay veriyorum.';

// Runs even on an already-showcased DB: creates the demo advisor account once
// and (re)assigns the showcase pipeline candidates to her.
async function ensureDemoAdvisor() {
  const demoAdvisors = [
    { email: 'aylin@zumra.local', name: 'Aylin Karaca', username: 'aylindanisman' },
    { email: 'selda@zumra.local', name: 'Selda Yıldız', username: 'seldadanisman' },
  ];

  let advisorId: string | null = null; // ilk danışman (Aylin) — atamalar ona
  for (const advisor of demoAdvisors) {
    const [existingAdvisor] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, advisor.username))
      .limit(1);
    let id = existingAdvisor?.id ?? null;
    if (!id) {
      const password = process.env.DEMO_SEED_PASSWORD ?? '';
      if (password.length < 8) {
        console.warn(
          'DEMO_SEED_PASSWORD tanımlı değil — danışman kullanıcıları atlandı.',
        );
        return;
      }
      id = randomUUID();
      await database.insert(users).values({
        id,
        name: advisor.name,
        email: advisor.email,
        emailVerified: true,
        username: advisor.username,
        displayUsername: advisor.username,
        role: 'advisor',
        accountStatus: 'active',
      });
      await database.insert(accounts).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: await hashPassword(password),
      });
      console.log(`Danışman kullanıcısı oluşturuldu: ${advisor.username}`);
    }
    advisorId = advisorId ?? id;
  }

  const showcaseMarkers = [
    'showcase-selin-acar-1',
    'showcase-melis-aydin-1',
    'showcase-derya-polat-1',
  ];
  const inquiries = await database
    .select({ candidateId: candidateInquiries.candidateId })
    .from(candidateInquiries)
    .where(inArray(candidateInquiries.idempotencyKey, showcaseMarkers));
  if (inquiries.length) {
    await database
      .update(candidateProfiles)
      .set({ advisorId, updatedAt: new Date() })
      .where(
        inArray(
          candidateProfiles.id,
          inquiries.map((inquiry) => inquiry.candidateId),
        ),
      );
    console.log(`${inquiries.length} showcase adayı Aylin'e atandı`);
  }

  // Görev backfill'i: Elif Kaya'nın bekleyen talebi ve sahipsiz yeni adaylar
  // havuza düşsün — tekrar çalıştırmak güvenli (kısmi unique engeller).
  const [pendingRequest] = await database
    .select({
      candidateId: appointmentRequests.candidateId,
      id: appointmentRequests.id,
    })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.status, 'requested'))
    .limit(1);
  if (pendingRequest) {
    await database
      .insert(advisorTasks)
      .values({
        appointmentId: pendingRequest.id,
        assigneeUserId: null,
        candidateId: pendingRequest.candidateId,
        kind: 'appointment_request',
        visibility: 'staff',
      })
      .onConflictDoNothing();
  }
  const unowned = await database
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(
      and(
        eq(candidateProfiles.stage, 'new'),
        sql`${candidateProfiles.advisorId} is null`,
      ),
    );
  for (const candidate of unowned) {
    await database
      .insert(advisorTasks)
      .values({
        assigneeUserId: null,
        candidateId: candidate.id,
        kind: 'first_contact',
        visibility: 'staff',
      })
      .onConflictDoNothing();
  }
  console.log(
    `Görev backfill: ${pendingRequest ? 1 : 0} talep + ${unowned.length} ilk temas havuza eklendi`,
  );
}

(async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('Üretimde çalıştırmak için ALLOW_DEMO_SEED=true gerekli.');
    process.exit(1);
  }

  await ensureDemoAdvisor();

  const [existing] = await database
    .select({ id: candidateInquiries.id })
    .from(candidateInquiries)
    .where(eq(candidateInquiries.idempotencyKey, MARKER))
    .limit(1);
  if (existing) {
    console.log('Showcase verisi zaten yüklü — ana blok atlandı.');
    process.exit(0);
  }

  await database.transaction(async (tx) => {
    // ---- lookups by natural keys -------------------------------------------
    const allUsers = await tx
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users);
    const byUsername = new Map(allUsers.map((u) => [u.username, u]));
    const need = (username: string) => {
      const row = byUsername.get(username);
      if (!row) throw new Error(`user eksik: ${username} — önce seed-demo çalıştır`);
      return row;
    };
    const admin = need('admin');
    const elifUser = need('elifhoca');
    const zeynepUser = need('zeynephoca');
    const merveUser = need('mervehoca');

    const iProfiles = await tx.select().from(instructorProfiles);
    const elif = iProfiles.find((p) => p.userId === elifUser.id)!;
    const zeynep = iProfiles.find((p) => p.userId === zeynepUser.id)!;
    const merve = iProfiles.find((p) => p.userId === merveUser.id)!;

    const sProfiles = await tx.select().from(studentProfiles);
    const studentByUser = new Map(sProfiles.map((p) => [p.userId, p]));
    const ayse = studentByUser.get(need('ayseyilmaz').id)!;
    const fatma = studentByUser.get(need('fatmademir').id)!;
    const zehra = studentByUser.get(need('zehraaydin').id)!;
    const hatice = studentByUser.get(need('haticesahin').id)!;

    const allPrograms = await tx.select().from(programs);
    const byProgramName = (name: string) => allPrograms.find((p) => p.name === name);
    const ozelDers = byProgramName('Özel Ders');
    if (!ozelDers) throw new Error("'Özel Ders' programı yok");
    const ingA1 = byProgramName('İngilizce Başlangıç (A1–A2)')!;
    const ingB1 = byProgramName('İngilizce Orta (B1–B2)')!;
    const almancaA1 = byProgramName('Almanca Başlangıç (A1)')!;

    const branches = await tx.select().from(programBranches);
    const branchByName = (name: string) => branches.find((b) => b.name === name)!;
    const sabah = branchByName('A1–A2 Sabah Grubu'); // Elif
    const b1Hafta = branchByName('B1–B2 Hafta İçi'); // Zeynep
    const kulup = branchByName('Konuşma Kulübü'); // Elif

    const [englishVersion] = await tx
      .select({ id: assessmentVersions.id })
      .from(assessmentVersions)
      .innerJoin(assessments, eq(assessments.id, assessmentVersions.assessmentId))
      .where(eq(assessments.language, 'english'))
      .limit(1);

    // ---- 0) junk cleanup: test candidates from earlier manual testing ------
    const junkContacts = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(like(contacts.email, '%@example.com'));
    if (junkContacts.length) {
      const junkIds = junkContacts.map((c) => c.id);
      const junkCandidates = await tx
        .select({ id: candidateProfiles.id })
        .from(candidateProfiles)
        .where(inArray(candidateProfiles.contactId, junkIds));
      const candIds = junkCandidates.map((c) => c.id);
      if (candIds.length) {
        const junkInquiries = await tx
          .select({ id: candidateInquiries.id })
          .from(candidateInquiries)
          .where(inArray(candidateInquiries.candidateId, candIds));
        const inqIds = junkInquiries.map((i) => i.id);
        if (inqIds.length) {
          const attempts = await tx
            .select({ id: assessmentAttempts.id })
            .from(assessmentAttempts)
            .where(inArray(assessmentAttempts.inquiryId, inqIds));
          if (attempts.length) {
            const attemptIds = attempts.map((a) => a.id);
            // assessment_results FK'si attempt'e restrict — önce sonuçlar.
            await tx.execute(
              sql`DELETE FROM assessment_results WHERE attempt_id = ANY(${attemptIds}::uuid[])`,
            );
            await tx
              .delete(assessmentAttempts)
              .where(inArray(assessmentAttempts.inquiryId, inqIds));
          }
          await tx
            .delete(appointmentRequests)
            .where(inArray(appointmentRequests.inquiryId, inqIds));
          await tx
            .delete(candidateConsents)
            .where(inArray(candidateConsents.inquiryId, inqIds));
        }
        await tx
          .delete(candidateActivities)
          .where(inArray(candidateActivities.candidateId, candIds));
        await tx.delete(candidateInquiries).where(inArray(candidateInquiries.candidateId, candIds));
        await tx.delete(candidateProfiles).where(inArray(candidateProfiles.id, candIds));
      }
      await tx.delete(contacts).where(inArray(contacts.id, junkIds));
      console.log(`Temizlik: ${junkContacts.length} test adayı silindi`);
    }

    // ---- 1) legal pages: publish the 4 drafts ------------------------------
    await tx.update(legalPages).set({ published: true, updatedAt: now });
    console.log('Hukuki sayfalar yayınlandı');

    // ---- 2) private (birebir) enrollment for Ayşe with Elif ----------------
    const [ayseEnrollment] = await tx
      .select()
      .from(enrollments)
      .where(eq(enrollments.studentId, ayse.id))
      .limit(1);
    const [ayseDraft] = await tx
      .select()
      .from(enrollmentDrafts)
      .where(eq(enrollmentDrafts.id, ayseEnrollment.draftId))
      .limit(1);
    const [elifRate] = await tx
      .select({ id: privateLessonStudentRates.id })
      .from(privateLessonStudentRates)
      .where(eq(privateLessonStudentRates.instructorProfileId, elif.id))
      .limit(1);

    // Clone Ayşe's completed draft/enrollment shells, retargeted to Özel Ders.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _d, ...draftBase } = ayseDraft;
    const [privateDraft] = await tx
      .insert(enrollmentDrafts)
      .values({
        ...draftBase,
        courseMode: 'private',
        programId: ozelDers.id,
        branchId: null,
        selectedInstructorProfileId: elif.id,
        privateLessonLanguage: 'english',
        privateLessonHours: 12,
        privateLessonRateId: elifRate?.id ?? null,
        finalPriceCents: 960_000,
        createdAt: new Date(now.getTime() - 28 * day),
        updatedAt: new Date(now.getTime() - 28 * day),
      })
      .returning({ id: enrollmentDrafts.id });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _e, ...enrollmentBase } = ayseEnrollment;
    const [privateEnrollment] = await tx
      .insert(enrollments)
      .values({
        ...enrollmentBase,
        draftId: privateDraft.id,
        courseMode: 'private',
        programId: ozelDers.id,
        branchId: null,
        selectedInstructorProfileId: elif.id,
        privateLessonRateId: elifRate?.id ?? null,
        finalPriceCents: 960_000,
        financialSnapshot: {},
        scheduleSnapshot: {},
        enrolledAt: new Date(now.getTime() - 28 * day),
        createdAt: new Date(now.getTime() - 28 * day),
        updatedAt: new Date(now.getTime() - 28 * day),
      })
      .returning({ id: enrollments.id });

    // 3 completed past + today 17:00 + next two weeks, all Friday 17:00.
    const privateSlots: Array<{ startsAt: Date; status: 'completed' | 'scheduled' }> =
      [-21, -14, -7].map((d) => ({
        startsAt: istDay(d, 17),
        status: 'completed' as const,
      }));
    privateSlots.push({ startsAt: istToday(17), status: 'scheduled' as const });
    privateSlots.push({ startsAt: istDay(7, 17), status: 'scheduled' as const });
    privateSlots.push({ startsAt: istDay(14, 17), status: 'scheduled' as const });

    const privateSessions = await tx
      .insert(lessonSessions)
      .values(
        privateSlots.map((slot) => ({
          source: 'private' as const,
          enrollmentId: privateEnrollment.id,
          studentProfileId: ayse.id,
          instructorProfileId: elif.id,
          startsAt: slot.startsAt,
          endsAt: new Date(slot.startsAt.getTime() + 50 * minute),
          timezone: TZ,
          status: slot.status,
          changeNote: '[seed-showcase]',
          createdByUserId: admin.id,
          createdAt: new Date(slot.startsAt.getTime() - 7 * day),
          updatedAt: new Date(slot.startsAt.getTime() - 7 * day),
        })),
      )
      .returning({ id: lessonSessions.id, startsAt: lessonSessions.startsAt, status: lessonSessions.status });

    await tx.insert(lessonAttendanceRecords).values(
      privateSessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          lessonSessionId: s.id,
          studentProfileId: ayse.id,
          status: 'present' as const,
          suggestedStatus: 'present' as const,
          source: 'teacher' as const,
          totalSeconds: 3000,
          confirmedAt: new Date(s.startsAt.getTime() + hour),
          confirmedByUserId: elifUser.id,
          createdAt: new Date(s.startsAt.getTime() + hour),
          updatedAt: new Date(s.startsAt.getTime() + hour),
        })),
    );
    console.log('Birebir kayıt + 6 birebir ders (3 tamamlanmış, bugün 17:00 dahil 3 planlı)');

    // ---- 3) cancel / postpone examples on Elif's future group lessons ------
    const elifFuture = await tx
      .select({ id: lessonSessions.id, startsAt: lessonSessions.startsAt, branchId: lessonSessions.branchId })
      .from(lessonSessions)
      .where(
        and(
          eq(lessonSessions.status, 'scheduled'),
          eq(lessonSessions.source, 'branch'),
          gte(lessonSessions.startsAt, now),
          inArray(lessonSessions.branchId, [sabah.id, kulup.id]),
        ),
      )
      .orderBy(asc(lessonSessions.startsAt));

    const toCancel = elifFuture.filter((s) => s.branchId === sabah.id)[2];
    if (toCancel) {
      await tx
        .update(lessonSessions)
        .set({
          status: 'cancelled',
          changeNote: 'Eğitmen sağlık raporu nedeniyle iptal edildi; telafi planlanacak.',
          updatedAt: now,
        })
        .where(eq(lessonSessions.id, toCancel.id));
    }
    const toPostpone = elifFuture.filter((s) => s.branchId === kulup.id)[1];
    if (toPostpone) {
      await tx
        .update(lessonSessions)
        .set({
          status: 'postponed',
          originalStartsAt: toPostpone.startsAt,
          startsAt: new Date(toPostpone.startsAt.getTime() + day),
          endsAt: new Date(toPostpone.startsAt.getTime() + day + 50 * minute),
          changeNote: 'Grubun talebiyle bir gün ertelendi.',
          updatedAt: now,
        })
        .where(eq(lessonSessions.id, toPostpone.id));
    }
    console.log('1 iptal + 1 erteleme örneği işlendi');

    // ---- 4) ready Meet links for every open session ------------------------
    const openSessions = await tx
      .select({ id: lessonSessions.id })
      .from(lessonSessions)
      .where(inArray(lessonSessions.status, ['scheduled', 'postponed']));
    const openIds = openSessions.map((s) => s.id);
    await tx.delete(lessonSessionMeetings).where(inArray(lessonSessionMeetings.lessonSessionId, openIds));
    await tx.insert(lessonSessionMeetings).values(
      openSessions.map((s) => ({
        lessonSessionId: s.id,
        provider: 'google_meet' as const,
        status: 'ready' as const,
        ...fakeMeet(s.id),
        organizerEmail: 'meet@zumra.local',
        attempts: 1,
        lastError: null,
        lastSyncedAt: now,
        nextSyncAt: null,
        nextRetryAt: null,
      })),
    );
    console.log(`${openSessions.length} ders için Meet bağlantısı hazır duruma getirildi`);

    // ---- 5) lesson-linked assignments + a pending submission ---------------
    const nextOf = async (branchId: string) => {
      const [row] = await tx
        .select({ id: lessonSessions.id, startsAt: lessonSessions.startsAt })
        .from(lessonSessions)
        .where(
          and(
            eq(lessonSessions.branchId, branchId),
            eq(lessonSessions.status, 'scheduled'),
            gte(lessonSessions.startsAt, now),
          ),
        )
        .orderBy(asc(lessonSessions.startsAt))
        .limit(1);
      return row;
    };
    const sabahNext = await nextOf(sabah.id);
    const b1Next = await nextOf(b1Hafta.id);

    const [linkedA] = await tx
      .insert(assignments)
      .values({
        instructorProfileId: elif.id,
        targetType: 'branch' as const,
        targetBranchId: sabah.id,
        lessonSessionId: sabahNext.id,
        title: 'Konuşma Pratiği: Kendini Tanıtma',
        description:
          'Yarınki dersimize hazırlık: kendinizi tanıtan 8-10 cümlelik bir konuşma hazırlayın ve sesli kaydını yükleyin.',
        requiresSubmission: true,
        maxScore: 100,
        dueAt: sabahNext.startsAt,
        createdByUserId: elifUser.id,
        createdAt: new Date(now.getTime() - day),
        updatedAt: new Date(now.getTime() - day),
      })
      .returning({ id: assignments.id, title: assignments.title });

    await tx.insert(assignmentSubmissions).values({
      assignmentId: linkedA.id,
      studentProfileId: ayse.id,
      status: 'submitted' as const,
      body: 'Öğretmenim merhaba, kendimi tanıttığım konuşma metnini hazırladım. Ses kaydını da ekledim.',
      isLate: false,
      submittedAt: istToday(10),
      createdAt: istToday(10),
      updatedAt: istToday(10),
    });

    const [linkedB] = await tx
      .insert(assignments)
      .values({
        instructorProfileId: zeynep.id,
        targetType: 'branch' as const,
        targetBranchId: b1Hafta.id,
        lessonSessionId: b1Next.id,
        title: 'Günlük Rutin Paragrafı (Present Simple)',
        description:
          'Bir sonraki dersimizle bağlantılı: günlük rutininizi anlatan 120 kelimelik bir paragraf yazın.',
        requiresSubmission: true,
        maxScore: 100,
        dueAt: new Date(b1Next.startsAt.getTime() + 4 * day),
        createdByUserId: zeynepUser.id,
        createdAt: new Date(now.getTime() - 2 * hour),
        updatedAt: new Date(now.getTime() - 2 * hour),
      })
      .returning({ id: assignments.id });
    console.log('2 derse bağlı ödev + 1 bekleyen teslim eklendi');

    // ---- 6) chat threads ----------------------------------------------------
    async function thread(
      student: { id: string; userId: string | null },
      teacher: { id: string; userId: string | null },
      msgs: Array<{ from: 'student' | 'instructor'; body: string; at: Date }>,
      opts: { studentReadAt: Date; instructorReadAt: Date },
    ) {
      const [conv] = await tx
        .insert(conversations)
        .values({
          studentProfileId: student.id,
          instructorProfileId: teacher.id,
          lastMessageAt: msgs[msgs.length - 1].at,
          studentLastReadAt: opts.studentReadAt,
          instructorLastReadAt: opts.instructorReadAt,
          createdAt: msgs[0].at,
          updatedAt: msgs[msgs.length - 1].at,
        })
        .returning({ id: conversations.id });
      await tx.insert(messages).values(
        msgs.map((m) => ({
          conversationId: conv.id,
          senderRole: m.from,
          senderUserId: m.from === 'student' ? student.userId! : teacher.userId!,
          body: m.body,
          createdAt: m.at,
        })),
      );
      return conv.id;
    }

    const ayseElifConv = await thread(
      ayse,
      elif,
      [
        { from: 'instructor', body: 'Merhaba Ayşe! Bugünkü birebir dersimiz 17:00’de, hazır mısın? 😊', at: new Date(now.getTime() - 3 * hour) },
        { from: 'student', body: 'Merhaba öğretmenim, hazırım! Kulaklığımı da denedim, ses sorunum yok.', at: new Date(now.getTime() - 3 * hour + 6 * minute) },
        { from: 'instructor', body: 'Harika! Geçen haftaki telaffuz çalışmasını da kısaca tekrar edelim.', at: new Date(now.getTime() - 3 * hour + 10 * minute) },
        { from: 'student', body: 'Öğretmenim konuşma ödevimi teslim ettim, kaydıma bakabilir misiniz? 🙏', at: new Date(now.getTime() - 45 * minute) },
      ],
      { studentReadAt: now, instructorReadAt: new Date(now.getTime() - hour) },
    );
    await thread(
      fatma,
      elif,
      [
        { from: 'student', body: 'Öğretmenim yarınki derste sınav tekrarı yapacak mıyız?', at: new Date(now.getTime() - day - 2 * hour) },
        { from: 'instructor', body: 'Evet Fatma, ilk 20 dakika tekrar yapacağız. Soruların varsa yanında getir 😊', at: new Date(now.getTime() - day - hour) },
        { from: 'student', body: 'Çok teşekkür ederim öğretmenim!', at: new Date(now.getTime() - day - 50 * minute) },
      ],
      { studentReadAt: new Date(now.getTime() - day), instructorReadAt: new Date(now.getTime() - day) },
    );
    const zehraZeynepConv = await thread(
      zehra,
      zeynep,
      [
        { from: 'student', body: 'Merhaba öğretmenim, essay ödevinde kaç paragraf bekliyorsunuz?', at: new Date(now.getTime() - 5 * hour) },
        { from: 'instructor', body: 'Merhaba Zehra! Giriş, 2 gelişme ve sonuç olmak üzere 4 paragraf yeterli.', at: new Date(now.getTime() - 4 * hour) },
        { from: 'instructor', body: 'Bir de yeni ödevi derse bağladım, detayları ödev sayfasında görebilirsin 📝', at: new Date(now.getTime() - 2 * hour) },
      ],
      { studentReadAt: new Date(now.getTime() - 3 * hour), instructorReadAt: now },
    );
    await thread(
      hatice,
      merve,
      [
        { from: 'student', body: 'Guten Tag! Öğretmenim artikel konusunu bir türlü oturtamadım 😅', at: new Date(now.getTime() - 2 * day) },
        { from: 'instructor', body: 'Guten Tag Hatice! Hiç dert etme, cumartesi dersinde tablo yöntemiyle anlatacağım.', at: new Date(now.getTime() - 2 * day + hour) },
        { from: 'student', body: 'Danke schön! 🙏', at: new Date(now.getTime() - 2 * day + hour + 10 * minute) },
      ],
      { studentReadAt: new Date(now.getTime() - day), instructorReadAt: new Date(now.getTime() - day) },
    );
    console.log('4 sohbet + 13 mesaj eklendi');

    // ---- 7) candidate pipeline with appointments in every state ------------
    async function candidate(input: {
      firstName: string;
      lastName: string;
      email: string;
      phoneSuffix: string;
      stage: 'new' | 'contacted' | 'qualified' | 'offer_pending' | 'lost';
      language: string;
      programId?: string | null;
      source: string;
      markerKey: string;
      lastActivityAt: Date;
      createdAgoDays: number;
      advisor?: boolean;
      test?: { level: string; score: number };
      note?: string;
      appointment?: {
        status: 'requested' | 'scheduled' | 'completed' | 'no_show';
        preferences?: Date[];
        scheduledStartsAt?: Date;
        outcomeNote?: string;
      };
      activities: Array<{ type: string; metadata?: Record<string, unknown>; hoursAgo: number }>;
    }) {
      const createdAt = new Date(now.getTime() - input.createdAgoDays * day);
      const [contact] = await tx
        .insert(contacts)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          normalizedEmail: input.email.toLowerCase(),
          phone: `0532 444 ${input.phoneSuffix}`,
          normalizedPhone: `+90532444${input.phoneSuffix.replace(/\s/g, '')}`,
          city: 'İstanbul',
          marketingConsent: true,
          isMinor: false,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: contacts.id });
      const [profile] = await tx
        .insert(candidateProfiles)
        .values({
          contactId: contact.id,
          stage: input.stage,
          advisorId: input.advisor ? admin.id : null,
          lastActivityAt: input.lastActivityAt,
          createdAt,
          updatedAt: input.lastActivityAt,
        })
        .returning({ id: candidateProfiles.id });
      const [inquiry] = await tx
        .insert(candidateInquiries)
        .values({
          candidateId: profile.id,
          language: input.language,
          programId: input.programId ?? null,
          source: input.source,
          locale: 'tr',
          status: 'open',
          formVersion: 'public-level-test-v1',
          idempotencyKey: input.markerKey,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: candidateInquiries.id });
      await tx.insert(candidateConsents).values([
        {
          contactId: contact.id,
          inquiryId: inquiry.id,
          type: 'candidate_notice',
          version: 'candidate-notice-v1',
          accepted: true,
          locale: 'tr',
          textSnapshot: CONSENT_SNAPSHOT,
          maskedIp: '88.230.xx.xx',
          acceptedAt: createdAt,
        },
        {
          contactId: contact.id,
          inquiryId: inquiry.id,
          type: 'marketing_email',
          version: 'candidate-notice-v1',
          accepted: true,
          locale: 'tr',
          textSnapshot: MARKETING_SNAPSHOT,
          maskedIp: '88.230.xx.xx',
          acceptedAt: createdAt,
        },
      ]);
      if (input.test && englishVersion) {
        await tx.insert(assessmentAttempts).values({
          inquiryId: inquiry.id,
          versionId: englishVersion.id,
          status: 'completed',
          resultLevel: input.test.level,
          score: input.test.score,
          continuationTokenHash: `showcase-${input.markerKey}`,
          startedAt: createdAt,
          completedAt: new Date(createdAt.getTime() + 18 * minute),
          expiresAt: new Date(createdAt.getTime() + 2 * day),
          createdAt,
          updatedAt: createdAt,
        });
      }
      if (input.note) {
        await tx.insert(candidateNotes).values({
          candidateId: profile.id,
          authorUserId: admin.id,
          body: input.note,
          createdAt: input.lastActivityAt,
        });
      }
      if (input.appointment) {
        const [request] = await tx
          .insert(appointmentRequests)
          .values({
            candidateId: profile.id,
            inquiryId: inquiry.id,
            timezone: TZ,
            status: input.appointment.status,
            scheduledStartsAt: input.appointment.scheduledStartsAt ?? null,
            outcomeNote: input.appointment.outcomeNote ?? null,
            createdAt,
            updatedAt: input.lastActivityAt,
          })
          .returning({ id: appointmentRequests.id });
        if (input.appointment.preferences) {
          await tx.insert(appointmentPreferences).values(
            input.appointment.preferences.map((startsAt, index) => ({
              requestId: request.id,
              rank: index + 1,
              startsAt,
              createdAt,
            })),
          );
        }
      }
      await tx.insert(candidateActivities).values(
        input.activities.map((a) => ({
          candidateId: profile.id,
          inquiryId: inquiry.id,
          type: a.type,
          metadata: a.metadata ?? {},
          occurredAt: new Date(now.getTime() - a.hoursAgo * hour),
        })),
      );
      return { profileId: profile.id, name: `${input.firstName} ${input.lastName}` };
    }

    // Bugün gelen taze lead — admin ziline düşer.
    await candidate({
      firstName: 'Gamze',
      lastName: 'Öztürk',
      email: 'gamze.ozturk@ornekmail.com',
      phoneSuffix: '10 01',
      stage: 'new',
      language: 'english',
      programId: ingA1.id,
      source: 'public_level_test',
      markerKey: 'showcase-gamze-ozturk-1',
      lastActivityAt: new Date(now.getTime() - 40 * minute),
      createdAgoDays: 0,
      test: { level: 'A2', score: 61 },
      activities: [
        { type: 'candidate.created_from_public_assessment', hoursAgo: 1 },
        { type: 'candidate.inquiry_received', hoursAgo: 1 },
        { type: 'candidate.assessment_completed', metadata: { level: 'A2', score: 61 }, hoursAgo: 0.7 },
      ],
    });

    // CANLI DEMO ADAYI — randevu talebi bekliyor, toplantıda onaylanacak.
    await candidate({
      firstName: 'Elif',
      lastName: 'Kaya',
      email: 'elif.kaya@ornekmail.com',
      phoneSuffix: '10 02',
      stage: 'new',
      language: 'english',
      programId: ingB1.id,
      source: 'program_inquiry',
      markerKey: MARKER,
      lastActivityAt: new Date(now.getTime() - 2 * hour),
      createdAgoDays: 1,
      test: { level: 'B1', score: 82 },
      appointment: {
        status: 'requested',
        preferences: [istDay(1, 11), istDay(1, 15), istDay(3, 13)],
      },
      activities: [
        { type: 'candidate.inquiry_received', hoursAgo: 26 },
        { type: 'candidate.assessment_completed', metadata: { level: 'B1', score: 82 }, hoursAgo: 25 },
        { type: 'candidate.appointment_requested', hoursAgo: 2 },
      ],
    });

    await candidate({
      firstName: 'Selin',
      lastName: 'Acar',
      email: 'selin.acar@ornekmail.com',
      phoneSuffix: '10 03',
      stage: 'contacted',
      language: 'german',
      programId: almancaA1.id,
      source: 'callback_request',
      markerKey: 'showcase-selin-acar-1',
      lastActivityAt: new Date(now.getTime() - 2 * day),
      createdAgoDays: 3,
      advisor: true,
      note: 'Telefonla ulaşıldı; Almanca A1 grubunu düşünüyor, hafta sonu saatleri uygun.',
      activities: [
        { type: 'candidate.inquiry_received', hoursAgo: 72 },
        { type: 'candidate.advisor_assigned', metadata: { advisorId: admin.id }, hoursAgo: 50 },
        { type: 'candidate.note_added', hoursAgo: 49 },
        { type: 'candidate.stage_changed', metadata: { from: 'new', to: 'contacted' }, hoursAgo: 48 },
      ],
    });

    await candidate({
      firstName: 'Melis',
      lastName: 'Aydın',
      email: 'melis.aydin@ornekmail.com',
      phoneSuffix: '10 04',
      stage: 'qualified',
      language: 'english',
      programId: ingB1.id,
      source: 'program_inquiry',
      markerKey: 'showcase-melis-aydin-1',
      lastActivityAt: new Date(now.getTime() - 5 * hour),
      createdAgoDays: 4,
      advisor: true,
      test: { level: 'B2', score: 88 },
      appointment: { status: 'scheduled', scheduledStartsAt: istDay(1, 14) },
      note: 'Seviye testi çok iyi; B2 hedefliyor. Yarınki görüşmede program detayları anlatılacak.',
      activities: [
        { type: 'candidate.inquiry_received', hoursAgo: 96 },
        { type: 'candidate.assessment_completed', metadata: { level: 'B2', score: 88 }, hoursAgo: 95 },
        { type: 'candidate.appointment_requested', hoursAgo: 70 },
        { type: 'candidate.stage_changed', metadata: { from: 'new', to: 'qualified' }, hoursAgo: 30 },
        { type: 'candidate.appointment_scheduled', metadata: { startsAt: istDay(1, 14).toISOString() }, hoursAgo: 5 },
      ],
    });

    await candidate({
      firstName: 'Derya',
      lastName: 'Polat',
      email: 'derya.polat@ornekmail.com',
      phoneSuffix: '10 05',
      stage: 'offer_pending',
      language: 'english',
      programId: ingA1.id,
      source: 'program_inquiry',
      markerKey: 'showcase-derya-polat-1',
      lastActivityAt: new Date(now.getTime() - 20 * hour),
      createdAgoDays: 6,
      advisor: true,
      test: { level: 'A1', score: 44 },
      appointment: {
        status: 'completed',
        scheduledStartsAt: istDay(-1, 15),
        outcomeNote:
          'Görüşme olumlu geçti; A1–A2 Sabah Grubu ve 3 taksitli ödeme planı önerildi. Eşiyle konuşup dönecek.',
      },
      note: 'Fiyat konusunda hassas; taksit seçeneği kararını olumlu etkileyebilir.',
      activities: [
        { type: 'candidate.inquiry_received', hoursAgo: 144 },
        { type: 'candidate.appointment_scheduled', metadata: { startsAt: istDay(-1, 15).toISOString() }, hoursAgo: 40 },
        { type: 'candidate.appointment_resolved', metadata: { outcome: 'completed' }, hoursAgo: 20 },
        { type: 'candidate.stage_changed', metadata: { from: 'qualified', to: 'offer_pending' }, hoursAgo: 19 },
      ],
    });

    await candidate({
      firstName: 'Nazlı',
      lastName: 'Erdem',
      email: 'nazli.erdem@ornekmail.com',
      phoneSuffix: '10 06',
      stage: 'lost',
      language: 'english',
      source: 'callback_request',
      markerKey: 'showcase-nazli-erdem-1',
      lastActivityAt: new Date(now.getTime() - 4 * day),
      createdAgoDays: 9,
      appointment: {
        status: 'no_show',
        scheduledStartsAt: istDay(-4, 16),
        outcomeNote: 'Görüşmeye katılmadı; iki kez arandı, ulaşılamadı.',
      },
      activities: [
        { type: 'candidate.inquiry_received', hoursAgo: 216 },
        { type: 'candidate.appointment_resolved', metadata: { outcome: 'no_show' }, hoursAgo: 96 },
        { type: 'candidate.stage_changed', metadata: { from: 'contacted', to: 'lost' }, hoursAgo: 95 },
      ],
    });
    console.log('6 aday (pipeline + randevu tüm durumları) eklendi');

    // ---- 8) unread bell notifications (bell-only; outbox'a asla yazma) -----
    await tx.insert(notifications).values([
      {
        userId: elifUser.id,
        type: 'assignment_submitted',
        payload: { assignmentTitle: linkedA.title, studentName: 'Ayşe Yılmaz' },
        href: `/ogretmen/odevler/${linkedA.id}`,
        createdAt: istToday(10),
      },
      {
        userId: elifUser.id,
        type: 'chat_message',
        payload: {
          fromName: 'Ayşe Yılmaz',
          preview: 'Öğretmenim konuşma ödevimi teslim ettim, kaydıma…',
          conversationId: ayseElifConv,
        },
        href: `/ogretmen/mesajlar?with=${ayse.id}`,
        createdAt: new Date(now.getTime() - 45 * minute),
      },
      {
        userId: need('ayseyilmaz').id,
        type: 'assignment_assigned',
        payload: { title: linkedA.title },
        href: `/ogrenci/odevler/${linkedA.id}`,
        createdAt: new Date(now.getTime() - day),
      },
      {
        userId: need('zehraaydin').id,
        type: 'chat_message',
        payload: {
          fromName: 'Zeynep Kaya',
          preview: 'Bir de yeni ödevi derse bağladım, detayları ödev…',
          conversationId: zehraZeynepConv,
        },
        href: `/ogrenci/mesajlar?with=${zeynep.id}`,
        createdAt: new Date(now.getTime() - 2 * hour),
      },
      {
        userId: need('zehraaydin').id,
        type: 'assignment_assigned',
        payload: { title: 'Günlük Rutin Paragrafı (Present Simple)' },
        href: `/ogrenci/odevler/${linkedB.id}`,
        createdAt: new Date(now.getTime() - 2 * hour),
      },
      {
        userId: admin.id,
        type: 'lead_received',
        payload: { kind: 'program', name: 'Gamze Öztürk', program: ingA1.name },
        href: '/admin/leads',
        createdAt: new Date(now.getTime() - 40 * minute),
      },
    ]);
    console.log('6 okunmamış zil bildirimi eklendi');
  });

  // Yeni oluşan showcase adaylarını da danışmana bağla.
  await ensureDemoAdvisor();

  console.log('Showcase verisi yüklendi ✅');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
