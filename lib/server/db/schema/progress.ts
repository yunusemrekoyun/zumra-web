import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { studentProfiles } from './enrollments';
import { instructorProfiles } from './instructors';

// The teacher's free-form overall evaluation of a student — the fourth
// progress parameter next to attendance, lesson history and assignment
// grades. One note per teacher/student pair, edited in place.
export const studentTeacherEvaluations = pgTable(
  'student_teacher_evaluations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    instructorProfileId: uuid('instructor_profile_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('student_teacher_evaluations_pair_unique').on(
      table.studentProfileId,
      table.instructorProfileId,
    ),
  ],
);
