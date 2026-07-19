import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { appointmentRequests, candidateProfiles } from './candidates';

// Advisor work queue. System tasks are BORN from CRM events and CLOSED by the
// action that satisfies them — staff never bookkeeps them by hand. Only
// 'manual' tasks are created and completed explicitly.
export const advisorTaskKindEnum = pgEnum('advisor_task_kind', [
  'appointment_request', // lead picked preferred times → answer the request
  'first_contact', // fresh unowned lead → make the first touch
  'follow_up', // "thinking" verdict → follow-up call (dueAt optional)
  'retry_contact', // could not be reached → try again
  'manual', // advisor's own to-do (e.g. preparing a presentation)
  'enrollment_wrapup', // enrollment draft opened → chase it to completion
  'enrollment_onboarding', // enrollment completed → welcome the new student
]);

export const advisorTaskStatusEnum = pgEnum('advisor_task_status', [
  'open',
  'done',
]);

// 'staff': every advisor + admin sees it (candidate work).
// 'private': only the owner + admins (personal to-dos).
export const advisorTaskVisibilityEnum = pgEnum('advisor_task_visibility', [
  'staff',
  'private',
]);

export const advisorTasks = pgTable(
  'advisor_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: advisorTaskKindEnum('kind').notNull(),
    status: advisorTaskStatusEnum('status').notNull().default('open'),
    visibility: advisorTaskVisibilityEnum('visibility')
      .notNull()
      .default('staff'),
    // Manual tasks carry their own title; system tasks are labeled by kind.
    title: text('title'),
    note: text('note'),
    candidateId: uuid('candidate_id').references(() => candidateProfiles.id, {
      onDelete: 'cascade',
    }),
    appointmentId: uuid('appointment_id').references(
      () => appointmentRequests.id,
      { onDelete: 'set null' },
    ),
    // null assignee = shared pool; claiming also assigns the candidate.
    assigneeUserId: text('assignee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: text('completed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('advisor_tasks_assignee_status_idx').on(
      table.assigneeUserId,
      table.status,
    ),
    index('advisor_tasks_status_due_idx').on(table.status, table.dueAt),
    index('advisor_tasks_candidate_idx').on(table.candidateId),
    // One OPEN system task per candidate+kind — events can fire repeatedly
    // (two no-answer calls) without piling up duplicate work items.
    uniqueIndex('advisor_tasks_open_candidate_kind_unique')
      .on(table.candidateId, table.kind)
      .where(
        sql`${table.status} = 'open' and ${table.candidateId} is not null and ${table.kind} <> 'manual'`,
      ),
  ],
);
