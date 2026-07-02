import 'server-only';

import { and, count, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  contacts,
  conversations,
  instructorProfiles,
  messages,
  studentProfiles,
} from '@/lib/server/db/schema';
import { PublicFlowError } from '@/lib/server/http/errors';
import {
  type ChatAssignmentRef,
  type ChatAttachment,
  loadAssignmentRefs,
  loadMessageAttachments,
} from './conversations';

// Read-only oversight of student↔teacher chat for the admin. Deliberately
// separate from conversations.ts: the party-scoped service keeps rejecting
// admin/advisor (anti-leakage stays intact), and nothing here writes — read
// state (last-read timestamps) belongs to the two parties and must not move
// when an admin views a thread.

const LIST_LIMIT = 200;
const TRANSCRIPT_PAGE_SIZE = 200;

export type AdminConversationListItem = {
  conversationId: string;
  studentName: string;
  instructorName: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  messageCount: number;
};

export type AdminTranscriptMessage = {
  id: string;
  senderRole: 'student' | 'instructor';
  senderName: string;
  body?: string;
  attachments: ChatAttachment[];
  assignment?: ChatAssignmentRef;
  createdAt: string;
};

export type AdminConversationTranscript = {
  conversationId: string;
  studentName: string;
  instructorName: string;
  messageCount: number;
  // True when there are messages older than this page — fetch the next page
  // with `before` = the first message's createdAt.
  hasOlder: boolean;
  messages: AdminTranscriptMessage[];
};

export type AdminConversationList = {
  conversations: AdminConversationListItem[];
  // True when the list hit LIST_LIMIT — older/idle conversations exist beyond
  // this page; the UI should tell the admin to narrow with search.
  truncated: boolean;
};

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export async function listAllConversations(
  query?: string,
): Promise<AdminConversationList> {
  const q = query?.trim();
  const nameFilter = q
    ? or(
        sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${`%${q}%`}`,
        sql`(${instructorProfiles.firstName} || ' ' || ${instructorProfiles.lastName}) ilike ${`%${q}%`}`,
      )
    : undefined;

  const rows = await database
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
    })
    .from(conversations)
    .innerJoin(
      studentProfiles,
      eq(studentProfiles.id, conversations.studentProfileId),
    )
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, conversations.instructorProfileId),
    )
    .where(nameFilter)
    .orderBy(
      sql`${conversations.lastMessageAt} desc nulls last`,
      desc(conversations.createdAt),
    )
    .limit(LIST_LIMIT);
  if (!rows.length) return { conversations: [], truncated: false };

  const convIds = rows.map((row) => row.id);

  const countRows = await database
    .select({ conversationId: messages.conversationId, total: count() })
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .groupBy(messages.conversationId);
  const countByConv = new Map(
    countRows.map((row) => [row.conversationId, Number(row.total)]),
  );

  const previewRows = await database
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(messages.conversationId, desc(messages.createdAt));
  const previewByConv = new Map(previewRows.map((row) => [row.conversationId, row]));

  return {
    conversations: rows.map((row) => {
      const preview = previewByConv.get(row.id);
      return {
        conversationId: row.id,
        studentName: fullName(row.studentFirstName, row.studentLastName),
        instructorName: fullName(
          row.instructorFirstName,
          row.instructorLastName,
        ),
        lastMessagePreview: preview?.body ?? undefined,
        lastMessageAt: (row.lastMessageAt ?? preview?.createdAt)?.toISOString(),
        messageCount: countByConv.get(row.id) ?? 0,
      };
    }),
    truncated: rows.length === LIST_LIMIT,
  };
}

export async function getConversationTranscript(
  conversationId: string,
  before?: Date,
): Promise<AdminConversationTranscript> {
  const [conversation] = await database
    .select({
      id: conversations.id,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
    })
    .from(conversations)
    .innerJoin(
      studentProfiles,
      eq(studentProfiles.id, conversations.studentProfileId),
    )
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, conversations.instructorProfileId),
    )
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) {
    throw new PublicFlowError('conversation_not_found', 404);
  }

  const studentName = fullName(
    conversation.studentFirstName,
    conversation.studentLastName,
  );
  const instructorName = fullName(
    conversation.instructorFirstName,
    conversation.instructorLastName,
  );

  const [countRow] = await database
    .select({ total: count() })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  const rows = await database
    .select()
    .from(messages)
    .where(
      before
        ? and(
            eq(messages.conversationId, conversationId),
            lt(messages.createdAt, before),
          )
        : eq(messages.conversationId, conversationId),
    )
    .orderBy(desc(messages.createdAt))
    .limit(TRANSCRIPT_PAGE_SIZE);
  const hasOlder = rows.length === TRANSCRIPT_PAGE_SIZE;
  rows.reverse();

  const attachments = await loadMessageAttachments(rows.map((row) => row.id));
  const assignmentIds = rows
    .map((row) => row.assignmentId)
    .filter((value): value is string => Boolean(value));
  const assignmentRefs = await loadAssignmentRefs(assignmentIds);

  return {
    conversationId,
    studentName,
    instructorName,
    messageCount: Number(countRow?.total ?? rows.length),
    hasOlder,
    messages: rows.map((row) => ({
      id: row.id,
      senderRole: row.senderRole,
      senderName: row.senderRole === 'student' ? studentName : instructorName,
      body: row.body ?? undefined,
      attachments: attachments.get(row.id) ?? [],
      assignment: row.assignmentId
        ? assignmentRefs.get(row.assignmentId)
        : undefined,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
