import 'server-only';

import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  staffConversations,
  staffMessages,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { createChatNotification } from './notification-feed';

const STAFF_ROLES = ['admin', 'advisor', 'teacher'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const MESSAGE_MAX_LENGTH = 4000;

function assertStaff(principal: WorkspacePrincipal) {
  if (!(STAFF_ROLES as readonly string[]).includes(principal.role)) {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

// Canonical pair order: a conversation row always stores the smaller user id
// first, so one pair maps to exactly one row.
function orderPair(first: string, second: string): [string, string] {
  return first < second ? [first, second] : [second, first];
}

function fullPath(role: StaffRole) {
  return role === 'admin'
    ? '/admin/messages?tab=staff'
    : role === 'advisor'
      ? '/danisman/mesajlar'
      : '/ogretmen/mesajlar?tab=staff';
}

export type StaffContact = {
  fullName: string;
  role: StaffRole;
  userId: string;
};

export type StaffConversationListItem = {
  id: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  peer: StaffContact;
  unreadCount: number;
};

export type StaffMessageView = {
  body: string;
  createdAt: string;
  id: string;
  mine: boolean;
};

async function loadStaffUser(userId: string) {
  const [row] = await database
    .select({
      accountStatus: users.accountStatus,
      id: users.id,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (
    !row ||
    row.accountStatus !== 'active' ||
    !(STAFF_ROLES as readonly string[]).includes(row.role)
  ) {
    return null;
  }
  return row;
}

async function loadMembership(principal: WorkspacePrincipal, conversationId: string) {
  const [conversation] = await database
    .select({
      aLastReadAt: staffConversations.aLastReadAt,
      bLastReadAt: staffConversations.bLastReadAt,
      id: staffConversations.id,
      participantAUserId: staffConversations.participantAUserId,
      participantBUserId: staffConversations.participantBUserId,
    })
    .from(staffConversations)
    .where(eq(staffConversations.id, conversationId))
    .limit(1);

  if (
    !conversation ||
    (conversation.participantAUserId !== principal.id &&
      conversation.participantBUserId !== principal.id)
  ) {
    throw new PublicFlowError('staff_conversation_not_found', 404);
  }

  const isA = conversation.participantAUserId === principal.id;
  return {
    conversation,
    isA,
    peerUserId: isA
      ? conversation.participantBUserId
      : conversation.participantAUserId,
  };
}

/** Every other active staff member — the "start a conversation" directory. */
export async function listStaffContacts(
  principal: WorkspacePrincipal,
): Promise<StaffContact[]> {
  assertStaff(principal);

  const rows = await database
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.role, [...STAFF_ROLES]),
        eq(users.accountStatus, 'active'),
      ),
    )
    .orderBy(asc(users.name));

  return rows
    .filter((row) => row.id !== principal.id)
    .map((row) => ({
      fullName: row.name,
      role: row.role as StaffRole,
      userId: row.id,
    }));
}

export async function listStaffConversations(
  principal: WorkspacePrincipal,
): Promise<StaffConversationListItem[]> {
  assertStaff(principal);

  const rows = await database
    .select({
      aLastReadAt: staffConversations.aLastReadAt,
      bLastReadAt: staffConversations.bLastReadAt,
      id: staffConversations.id,
      lastMessageAt: staffConversations.lastMessageAt,
      participantAUserId: staffConversations.participantAUserId,
      participantBUserId: staffConversations.participantBUserId,
      peerName: users.name,
      peerRole: users.role,
    })
    .from(staffConversations)
    .innerJoin(
      users,
      sql`${users.id} = case when ${staffConversations.participantAUserId} = ${principal.id} then ${staffConversations.participantBUserId} else ${staffConversations.participantAUserId} end`,
    )
    .where(
      or(
        eq(staffConversations.participantAUserId, principal.id),
        eq(staffConversations.participantBUserId, principal.id),
      ),
    )
    .orderBy(desc(staffConversations.lastMessageAt));

  if (!rows.length) return [];

  const conversationIds = rows.map((row) => row.id);
  const previews = await database
    .select({
      body: staffMessages.body,
      conversationId: staffMessages.conversationId,
      createdAt: staffMessages.createdAt,
      senderUserId: staffMessages.senderUserId,
    })
    .from(staffMessages)
    .where(
      inArray(staffMessages.conversationId, conversationIds),
    )
    .orderBy(desc(staffMessages.createdAt));

  const previewByConversation = new Map<string, (typeof previews)[number]>();
  for (const message of previews) {
    if (!previewByConversation.has(message.conversationId)) {
      previewByConversation.set(message.conversationId, message);
    }
  }

  // Unread = peer messages newer than my last-read timestamp.
  const unreadRows = await database
    .select({
      conversationId: staffMessages.conversationId,
      count: sql<number>`count(*)::int`,
    })
    .from(staffMessages)
    .innerJoin(
      staffConversations,
      eq(staffConversations.id, staffMessages.conversationId),
    )
    .where(
      and(
        inArray(staffMessages.conversationId, conversationIds),
        sql`${staffMessages.senderUserId} <> ${principal.id}`,
        sql`${staffMessages.createdAt} > coalesce(
          case when ${staffConversations.participantAUserId} = ${principal.id}
            then ${staffConversations.aLastReadAt}
            else ${staffConversations.bLastReadAt} end,
          'epoch'::timestamptz
        )`,
      ),
    )
    .groupBy(staffMessages.conversationId);
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversationId, Number(row.count)]),
  );

  return rows.map((row) => {
    const preview = previewByConversation.get(row.id);
    const peerUserId =
      row.participantAUserId === principal.id
        ? row.participantBUserId
        : row.participantAUserId;
    return {
      id: row.id,
      lastMessageAt:
        row.lastMessageAt?.toISOString() ??
        preview?.createdAt.toISOString() ??
        null,
      lastMessagePreview: preview?.body.slice(0, 80) ?? null,
      peer: {
        fullName: row.peerName,
        role: row.peerRole as StaffRole,
        userId: peerUserId,
      },
      unreadCount: unreadByConversation.get(row.id) ?? 0,
    };
  });
}

/** Get-or-create the conversation with another staff member. */
export async function resolveStaffConversation(
  principal: WorkspacePrincipal,
  peerUserId: string,
) {
  assertStaff(principal);

  if (peerUserId === principal.id) {
    throw new PublicFlowError('staff_peer_invalid', 400);
  }
  const peer = await loadStaffUser(peerUserId);
  if (!peer) {
    throw new PublicFlowError('staff_peer_invalid', 400);
  }

  const [first, second] = orderPair(principal.id, peerUserId);
  const [existing] = await database
    .select({ id: staffConversations.id })
    .from(staffConversations)
    .where(
      and(
        eq(staffConversations.participantAUserId, first),
        eq(staffConversations.participantBUserId, second),
      ),
    )
    .limit(1);
  if (existing) return { id: existing.id };

  const [created] = await database
    .insert(staffConversations)
    .values({ participantAUserId: first, participantBUserId: second })
    .onConflictDoNothing({
      target: [
        staffConversations.participantAUserId,
        staffConversations.participantBUserId,
      ],
    })
    .returning({ id: staffConversations.id });
  if (created) return { id: created.id };

  const [raced] = await database
    .select({ id: staffConversations.id })
    .from(staffConversations)
    .where(
      and(
        eq(staffConversations.participantAUserId, first),
        eq(staffConversations.participantBUserId, second),
      ),
    )
    .limit(1);
  return { id: raced.id };
}

export async function getStaffMessages(
  principal: WorkspacePrincipal,
  conversationId: string,
  options: { afterId?: string } = {},
): Promise<StaffMessageView[]> {
  assertStaff(principal);
  await loadMembership(principal, conversationId);

  let afterCreatedAt: Date | null = null;
  if (options.afterId) {
    const [anchor] = await database
      .select({ createdAt: staffMessages.createdAt })
      .from(staffMessages)
      .where(
        and(
          eq(staffMessages.id, options.afterId),
          eq(staffMessages.conversationId, conversationId),
        ),
      )
      .limit(1);
    afterCreatedAt = anchor?.createdAt ?? null;
  }

  const rows = await database
    .select({
      body: staffMessages.body,
      createdAt: staffMessages.createdAt,
      id: staffMessages.id,
      senderUserId: staffMessages.senderUserId,
    })
    .from(staffMessages)
    .where(
      and(
        eq(staffMessages.conversationId, conversationId),
        afterCreatedAt ? gt(staffMessages.createdAt, afterCreatedAt) : undefined,
      ),
    )
    .orderBy(asc(staffMessages.createdAt))
    .limit(200);

  return rows.map((row) => ({
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    mine: row.senderUserId === principal.id,
  }));
}

export async function sendStaffMessage(
  principal: WorkspacePrincipal,
  conversationId: string,
  body: string,
) {
  assertStaff(principal);
  const membership = await loadMembership(principal, conversationId);

  const cleaned = body.trim().slice(0, MESSAGE_MAX_LENGTH);
  if (!cleaned) {
    throw new PublicFlowError('staff_message_empty', 400);
  }

  const now = new Date();
  const [message] = await database
    .insert(staffMessages)
    .values({
      body: cleaned,
      conversationId,
      senderUserId: principal.id,
    })
    .returning({ createdAt: staffMessages.createdAt, id: staffMessages.id });

  await database
    .update(staffConversations)
    .set({
      lastMessageAt: now,
      updatedAt: now,
      // Sending also reads the thread up to now for the sender's side.
      ...(membership.isA ? { aLastReadAt: now } : { bLastReadAt: now }),
    })
    .where(eq(staffConversations.id, conversationId));

  // Bell notification to the peer (collapsed to one entry per conversation).
  try {
    const peer = await loadStaffUser(membership.peerUserId);
    if (peer) {
      await createChatNotification(
        peer.id,
        conversationId,
        { fromName: principal.name ?? '' },
        fullPath(peer.role as StaffRole),
      );
    }
  } catch {
    // best-effort
  }

  return {
    body: cleaned,
    createdAt: message.createdAt.toISOString(),
    id: message.id,
    mine: true,
  };
}

export async function markStaffConversationRead(
  principal: WorkspacePrincipal,
  conversationId: string,
) {
  assertStaff(principal);
  const membership = await loadMembership(principal, conversationId);

  const now = new Date();
  await database
    .update(staffConversations)
    .set(
      membership.isA
        ? { aLastReadAt: now, updatedAt: now }
        : { bLastReadAt: now, updatedAt: now },
    )
    .where(eq(staffConversations.id, conversationId));

  return { ok: true };
}
