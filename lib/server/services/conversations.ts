import 'server-only';

import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignments,
  contacts,
  conversations,
  enrollments,
  instructorProfiles,
  mediaAssets,
  messageAttachments,
  messages,
  programBranches,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { notifyNewMessage } from './notify-events';

const activeEnrollmentStatuses = ['active', 'paused'] as const;
const MESSAGE_PAGE_SIZE = 100;

type ChatRole = 'student' | 'instructor';

export type ChatAttachment = {
  mediaAssetId: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'audio';
  sizeBytes?: number;
};

export type ChatAssignmentRef = {
  id: string;
  title: string;
  requiresSubmission: boolean;
};

export type ChatMessageView = {
  id: string;
  senderRole: ChatRole;
  mine: boolean;
  body?: string;
  attachments: ChatAttachment[];
  assignment?: ChatAssignmentRef;
  createdAt: string;
};

export type ConversationListItem = {
  conversationId: string | null;
  otherPartyProfileId: string;
  otherPartyName: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

export type ConversationView = {
  conversationId: string;
  otherPartyName: string;
  myRole: ChatRole;
  messages: ChatMessageView[];
};

// ---------------------------------------------------------------------------
// principal → profile + relationship
// ---------------------------------------------------------------------------

async function requireInstructorProfileId(
  principal: WorkspacePrincipal,
): Promise<string> {
  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);
  if (!profile) {
    throw new AuthorizationDeniedError('Instructor profile not found.');
  }
  return profile.id;
}

async function requireStudentProfileId(
  principal: WorkspacePrincipal,
): Promise<string> {
  const [profile] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) {
    throw new AuthorizationDeniedError('Student profile not found.');
  }
  return profile.id;
}

async function areRelated(
  studentProfileId: string,
  instructorProfileId: string,
): Promise<boolean> {
  const [row] = await database
    .select({ id: enrollments.id })
    .from(enrollments)
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(
      and(
        eq(enrollments.studentId, studentProfileId),
        inArray(enrollments.status, activeEnrollmentStatuses),
        sql`(${enrollments.selectedInstructorProfileId} = ${instructorProfileId} or ${programBranches.instructorProfileId} = ${instructorProfileId})`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function toNumber(value: number | string | null): number | undefined {
  return value == null ? undefined : Number(value);
}

async function assertMediaOwnedAndReady(
  mediaIds: string[],
  ownerUserId: string,
) {
  if (!mediaIds.length) return;
  const rows = await database
    .select({
      id: mediaAssets.id,
      owner: mediaAssets.ownerUserId,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, mediaIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of mediaIds) {
    const row = byId.get(id);
    if (!row || row.owner !== ownerUserId) {
      throw new PublicFlowError('attachment_forbidden', 403);
    }
    if (row.status !== 'ready') {
      throw new PublicFlowError('attachment_not_ready', 409);
    }
  }
}

export async function loadMessageAttachments(
  messageIds: string[],
): Promise<Map<string, ChatAttachment[]>> {
  const result = new Map<string, ChatAttachment[]>();
  if (!messageIds.length) return result;
  const rows = await database
    .select({
      messageId: messageAttachments.messageId,
      mediaAssetId: mediaAssets.id,
      name: mediaAssets.originalName,
      kind: mediaAssets.kind,
      sizeBytes: mediaAssets.sizeBytes,
    })
    .from(messageAttachments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, messageAttachments.mediaAssetId))
    .where(inArray(messageAttachments.messageId, messageIds));
  for (const row of rows) {
    const list = result.get(row.messageId) ?? [];
    list.push({
      mediaAssetId: row.mediaAssetId,
      name: row.name,
      kind: row.kind,
      sizeBytes: toNumber(row.sizeBytes),
    });
    result.set(row.messageId, list);
  }
  return result;
}

export async function loadAssignmentRefs(
  assignmentIds: string[],
): Promise<Map<string, ChatAssignmentRef>> {
  const result = new Map<string, ChatAssignmentRef>();
  if (!assignmentIds.length) return result;
  const rows = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      requiresSubmission: assignments.requiresSubmission,
    })
    .from(assignments)
    .where(inArray(assignments.id, assignmentIds));
  for (const row of rows) result.set(row.id, row);
  return result;
}

// ---------------------------------------------------------------------------
// resolve / list
// ---------------------------------------------------------------------------

export async function resolveConversation(
  principal: WorkspacePrincipal,
  otherProfileId: string,
): Promise<{ conversationId: string; otherPartyName: string; myRole: ChatRole }> {
  let studentProfileId: string;
  let instructorProfileId: string;
  let myRole: ChatRole;

  if (principal.role === 'teacher') {
    instructorProfileId = await requireInstructorProfileId(principal);
    studentProfileId = otherProfileId;
    myRole = 'instructor';
  } else if (principal.role === 'student') {
    studentProfileId = await requireStudentProfileId(principal);
    instructorProfileId = otherProfileId;
    myRole = 'student';
  } else {
    throw new AuthorizationDeniedError('Chat is not available for this role.');
  }

  if (!(await areRelated(studentProfileId, instructorProfileId))) {
    throw new PublicFlowError('conversation_forbidden', 403);
  }

  const [existing] = await database
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.studentProfileId, studentProfileId),
        eq(conversations.instructorProfileId, instructorProfileId),
      ),
    )
    .limit(1);

  const conversationId =
    existing?.id ??
    (
      await database
        .insert(conversations)
        .values({ studentProfileId, instructorProfileId })
        .onConflictDoNothing()
        .returning({ id: conversations.id })
    )[0]?.id ??
    (
      await database
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.studentProfileId, studentProfileId),
            eq(conversations.instructorProfileId, instructorProfileId),
          ),
        )
        .limit(1)
    )[0]?.id;

  if (!conversationId) {
    throw new Error('Conversation could not be created.');
  }

  const otherPartyName = await nameForProfile(
    myRole === 'instructor' ? 'student' : 'instructor',
    myRole === 'instructor' ? studentProfileId : instructorProfileId,
  );

  return { conversationId, otherPartyName, myRole };
}

async function nameForProfile(role: ChatRole, profileId: string) {
  if (role === 'student') {
    const [row] = await database
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(studentProfiles)
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(eq(studentProfiles.id, profileId))
      .limit(1);
    return row ? fullName(row.firstName, row.lastName) : '—';
  }
  const [row] = await database
    .select({
      firstName: instructorProfiles.firstName,
      lastName: instructorProfiles.lastName,
    })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.id, profileId))
    .limit(1);
  return row ? fullName(row.firstName, row.lastName) : '—';
}

export async function listConversations(
  principal: WorkspacePrincipal,
): Promise<ConversationListItem[]> {
  const isTeacher = principal.role === 'teacher';
  const isStudent = principal.role === 'student';
  if (!isTeacher && !isStudent) {
    throw new AuthorizationDeniedError('Chat is not available for this role.');
  }

  // 1) Derive the relationship roster (the other parties).
  const roster = isTeacher
    ? await teacherRoster(await requireInstructorProfileId(principal))
    : await studentRoster(await requireStudentProfileId(principal));
  if (!roster.length) return [];

  const myProfileId = isTeacher
    ? await requireInstructorProfileId(principal)
    : await requireStudentProfileId(principal);

  // 2) Existing conversations for these pairs.
  const otherIds = roster.map((entry) => entry.profileId);
  const convRows = await database
    .select()
    .from(conversations)
    .where(
      isTeacher
        ? and(
            eq(conversations.instructorProfileId, myProfileId),
            inArray(conversations.studentProfileId, otherIds),
          )
        : and(
            eq(conversations.studentProfileId, myProfileId),
            inArray(conversations.instructorProfileId, otherIds),
          ),
    );
  const convByOther = new Map(
    convRows.map((row) => [
      isTeacher ? row.studentProfileId : row.instructorProfileId,
      row,
    ]),
  );

  // 3) Unread counts + last message previews per conversation.
  const convIds = convRows.map((row) => row.id);
  const lastByConv = new Map<string, { body: string | null; createdAt: Date }>();
  const unreadByConv = new Map<string, number>();
  if (convIds.length) {
    const msgRows = await database
      .select({
        conversationId: messages.conversationId,
        senderRole: messages.senderRole,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.conversationId, convIds))
      .orderBy(asc(messages.createdAt));
    const lastReadByConv = new Map(
      convRows.map((row) => [
        row.id,
        isTeacher ? row.instructorLastReadAt : row.studentLastReadAt,
      ]),
    );
    const myRole: ChatRole = isTeacher ? 'instructor' : 'student';
    for (const msg of msgRows) {
      lastByConv.set(msg.conversationId, {
        body: msg.body,
        createdAt: msg.createdAt,
      });
      const lastRead = lastReadByConv.get(msg.conversationId) ?? null;
      const isUnread =
        msg.senderRole !== myRole &&
        (!lastRead || msg.createdAt > lastRead);
      if (isUnread) {
        unreadByConv.set(
          msg.conversationId,
          (unreadByConv.get(msg.conversationId) ?? 0) + 1,
        );
      }
    }
  }

  // 4) Assemble, newest conversation first then alphabetical.
  const items: ConversationListItem[] = roster.map((entry) => {
    const conv = convByOther.get(entry.profileId);
    const last = conv ? lastByConv.get(conv.id) : undefined;
    return {
      conversationId: conv?.id ?? null,
      otherPartyProfileId: entry.profileId,
      otherPartyName: entry.name,
      lastMessagePreview: last?.body ?? undefined,
      lastMessageAt: (conv?.lastMessageAt ?? last?.createdAt)?.toISOString(),
      unreadCount: conv ? (unreadByConv.get(conv.id) ?? 0) : 0,
    };
  });

  items.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    }
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.otherPartyName.localeCompare(b.otherPartyName);
  });
  return items;
}

async function teacherRoster(instructorProfileId: string) {
  const rows = await database
    .select({
      profileId: studentProfiles.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(
      and(
        inArray(enrollments.status, activeEnrollmentStatuses),
        sql`(${enrollments.selectedInstructorProfileId} = ${instructorProfileId} or ${programBranches.instructorProfileId} = ${instructorProfileId})`,
      ),
    );
  return dedupeRoster(rows);
}

async function studentRoster(studentProfileId: string) {
  const rows = await database
    .select({
      profileId: instructorProfiles.id,
      firstName: instructorProfiles.firstName,
      lastName: instructorProfiles.lastName,
    })
    .from(enrollments)
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .innerJoin(
      instructorProfiles,
      sql`${instructorProfiles.id} = coalesce(${enrollments.selectedInstructorProfileId}, ${programBranches.instructorProfileId})`,
    )
    .where(
      and(
        eq(enrollments.studentId, studentProfileId),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    );
  return dedupeRoster(rows);
}

function dedupeRoster(
  rows: { profileId: string; firstName: string; lastName: string }[],
) {
  const seen = new Set<string>();
  const out: { profileId: string; name: string }[] = [];
  for (const row of rows) {
    if (seen.has(row.profileId)) continue;
    seen.add(row.profileId);
    out.push({ profileId: row.profileId, name: fullName(row.firstName, row.lastName) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// party auth + messages
// ---------------------------------------------------------------------------

async function requireConversationParty(
  principal: WorkspacePrincipal,
  conversationId: string,
): Promise<{ conversation: typeof conversations.$inferSelect; myRole: ChatRole }> {
  const [conversation] = await database
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) throw new PublicFlowError('conversation_not_found', 404);

  if (principal.role === 'teacher') {
    const me = await requireInstructorProfileId(principal);
    if (conversation.instructorProfileId !== me) {
      throw new PublicFlowError('conversation_forbidden', 403);
    }
    return { conversation, myRole: 'instructor' };
  }
  if (principal.role === 'student') {
    const me = await requireStudentProfileId(principal);
    if (conversation.studentProfileId !== me) {
      throw new PublicFlowError('conversation_forbidden', 403);
    }
    return { conversation, myRole: 'student' };
  }
  throw new AuthorizationDeniedError('Chat is not available for this role.');
}

function mapMessages(
  rows: (typeof messages.$inferSelect)[],
  attachments: Map<string, ChatAttachment[]>,
  assignmentRefs: Map<string, ChatAssignmentRef>,
  myRole: ChatRole,
): ChatMessageView[] {
  return rows.map((row) => ({
    id: row.id,
    senderRole: row.senderRole,
    mine: row.senderRole === myRole,
    body: row.body ?? undefined,
    attachments: attachments.get(row.id) ?? [],
    assignment: row.assignmentId
      ? assignmentRefs.get(row.assignmentId)
      : undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

function assignmentIdsOf(rows: (typeof messages.$inferSelect)[]): string[] {
  return rows
    .map((row) => row.assignmentId)
    .filter((value): value is string => Boolean(value));
}

export async function getConversationMessages(
  principal: WorkspacePrincipal,
  conversationId: string,
): Promise<ConversationView> {
  const { conversation, myRole } = await requireConversationParty(
    principal,
    conversationId,
  );

  const rows = await database
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGE_PAGE_SIZE);
  rows.reverse();

  const attachments = await loadMessageAttachments(rows.map((row) => row.id));
  const assignmentRefs = await loadAssignmentRefs(assignmentIdsOf(rows));
  const otherPartyName = await nameForProfile(
    myRole === 'instructor' ? 'student' : 'instructor',
    myRole === 'instructor'
      ? conversation.studentProfileId
      : conversation.instructorProfileId,
  );

  return {
    conversationId,
    otherPartyName,
    myRole,
    messages: mapMessages(rows, attachments, assignmentRefs, myRole),
  };
}

export async function getMessagesSince(
  principal: WorkspacePrincipal,
  conversationId: string,
  sinceIso: string,
): Promise<ChatMessageView[]> {
  const { myRole } = await requireConversationParty(principal, conversationId);
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) {
    throw new PublicFlowError('invalid_cursor', 400);
  }
  const rows = await database
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        gt(messages.createdAt, since),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(MESSAGE_PAGE_SIZE);
  const attachments = await loadMessageAttachments(rows.map((row) => row.id));
  const assignmentRefs = await loadAssignmentRefs(assignmentIdsOf(rows));
  return mapMessages(rows, attachments, assignmentRefs, myRole);
}

// Conversation-scoped full-text search (Turkish stemming). One conversation is
// a small set, so a per-conversation scan is fast — no GIN index needed yet.
export async function searchMessages(
  principal: WorkspacePrincipal,
  conversationId: string,
  query: string,
): Promise<ChatMessageView[]> {
  const { myRole } = await requireConversationParty(principal, conversationId);
  const q = query.trim();
  if (!q) return [];

  const rows = await database
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`to_tsvector('turkish', coalesce(${messages.body}, '')) @@ plainto_tsquery('turkish', ${q})`,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50);

  const attachments = await loadMessageAttachments(rows.map((row) => row.id));
  const assignmentRefs = await loadAssignmentRefs(assignmentIdsOf(rows));
  return mapMessages(rows, attachments, assignmentRefs, myRole);
}

export async function sendMessage(
  principal: WorkspacePrincipal,
  input: {
    conversationId: string;
    body?: string | null;
    attachmentMediaIds?: string[];
    assignmentId?: string | null;
  },
): Promise<{ id: string; createdAt: string }> {
  const { myRole } = await requireConversationParty(
    principal,
    input.conversationId,
  );

  const body = input.body?.trim() || null;
  const attachmentMediaIds = input.attachmentMediaIds ?? [];
  if (!body && !attachmentMediaIds.length && !input.assignmentId) {
    throw new PublicFlowError('message_empty', 400);
  }
  await assertMediaOwnedAndReady(attachmentMediaIds, principal.id);

  const now = new Date();
  const [created] = await database
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      senderRole: myRole,
      senderUserId: principal.id,
      body,
      assignmentId: input.assignmentId ?? null,
      createdAt: now,
    })
    .returning({ id: messages.id, createdAt: messages.createdAt });

  if (attachmentMediaIds.length) {
    await database
      .insert(messageAttachments)
      .values(
        attachmentMediaIds.map((mediaAssetId) => ({
          messageId: created.id,
          mediaAssetId,
        })),
      )
      .onConflictDoNothing();
  }

  // Bump conversation activity + mark the sender's own side as read.
  await database
    .update(conversations)
    .set({
      lastMessageAt: now,
      updatedAt: now,
      ...(myRole === 'instructor'
        ? { instructorLastReadAt: now }
        : { studentLastReadAt: now }),
    })
    .where(eq(conversations.id, input.conversationId));

  await notifyNewMessage({
    conversationId: input.conversationId,
    senderRole: myRole,
    preview: (body ?? '').slice(0, 100),
  });

  return { id: created.id, createdAt: created.createdAt.toISOString() };
}

// Total unread messages across all of the user's conversations — for the
// global nav badge. Returns 0 (never throws) for users without a profile.
export async function getTotalUnread(
  principal: WorkspacePrincipal,
): Promise<number> {
  const isTeacher = principal.role === 'teacher';
  const isStudent = principal.role === 'student';
  if (!isTeacher && !isStudent) return 0;

  let myProfileId: string;
  try {
    myProfileId = isTeacher
      ? await requireInstructorProfileId(principal)
      : await requireStudentProfileId(principal);
  } catch {
    return 0;
  }

  const convRows = await database
    .select({
      id: conversations.id,
      studentLastReadAt: conversations.studentLastReadAt,
      instructorLastReadAt: conversations.instructorLastReadAt,
    })
    .from(conversations)
    .where(
      isTeacher
        ? eq(conversations.instructorProfileId, myProfileId)
        : eq(conversations.studentProfileId, myProfileId),
    );
  if (!convRows.length) return 0;

  const lastReadByConv = new Map(
    convRows.map((row) => [
      row.id,
      isTeacher ? row.instructorLastReadAt : row.studentLastReadAt,
    ]),
  );
  const otherRole: ChatRole = isTeacher ? 'student' : 'instructor';

  const msgRows = await database
    .select({
      conversationId: messages.conversationId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        inArray(
          messages.conversationId,
          convRows.map((row) => row.id),
        ),
        eq(messages.senderRole, otherRole),
      ),
    );

  let total = 0;
  for (const msg of msgRows) {
    const lastRead = lastReadByConv.get(msg.conversationId) ?? null;
    if (!lastRead || msg.createdAt > lastRead) total += 1;
  }
  return total;
}

export async function markConversationRead(
  principal: WorkspacePrincipal,
  conversationId: string,
): Promise<void> {
  const { myRole } = await requireConversationParty(principal, conversationId);
  await database
    .update(conversations)
    .set(
      myRole === 'instructor'
        ? { instructorLastReadAt: new Date() }
        : { studentLastReadAt: new Date() },
    )
    .where(eq(conversations.id, conversationId));
}

// Teacher shares one of their assignments into the chat with a student — posts
// an assignment-card message into the (resolved) conversation.
export async function shareAssignmentInChat(
  principal: WorkspacePrincipal,
  assignmentId: string,
  studentProfileId: string,
): Promise<void> {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Only teachers can share assignments.');
  }
  const instructorProfileId = await requireInstructorProfileId(principal);
  const [owned] = await database
    .select({ id: assignments.id })
    .from(assignments)
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.instructorProfileId, instructorProfileId),
      ),
    )
    .limit(1);
  if (!owned) throw new PublicFlowError('assignment_not_found', 404);

  const { conversationId } = await resolveConversation(
    principal,
    studentProfileId,
  );
  await sendMessage(principal, { conversationId, assignmentId });
}
