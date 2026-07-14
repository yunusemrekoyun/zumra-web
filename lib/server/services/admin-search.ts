import 'server-only';

import { asc, eq, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  candidateProfiles,
  contacts,
  instructorProfiles,
  studentProfiles,
} from '@/lib/server/db/schema';

const GROUP_LIMIT = 5;

export type AdminSearchResultType = 'student' | 'instructor' | 'candidate';

export type AdminSearchResult = {
  type: AdminSearchResultType;
  id: string;
  name: string;
  subtitle?: string;
  href: string;
};

// Directory search behind the admin shell's global search box. Name-based,
// small fixed limits per group — this backs a command palette, not a report.
export async function searchAdminDirectory(
  query: string,
): Promise<AdminSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Escape LIKE wildcards so a literal % or _ in the query doesn't match everything.
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;

  const [students, instructors, candidates] = await Promise.all([
    database
      .select({
        id: studentProfiles.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(studentProfiles)
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(
        sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${pattern}`,
      )
      .orderBy(asc(contacts.firstName))
      .limit(GROUP_LIMIT),
    database
      .select({
        id: instructorProfiles.id,
        firstName: instructorProfiles.firstName,
        lastName: instructorProfiles.lastName,
        email: instructorProfiles.email,
      })
      .from(instructorProfiles)
      .where(
        sql`(${instructorProfiles.firstName} || ' ' || ${instructorProfiles.lastName}) ilike ${pattern}`,
      )
      .orderBy(asc(instructorProfiles.firstName))
      .limit(GROUP_LIMIT),
    database
      .select({
        id: candidateProfiles.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(candidateProfiles)
      .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
      .where(
        sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${pattern}`,
      )
      .orderBy(asc(contacts.firstName))
      .limit(GROUP_LIMIT),
  ]);

  return [
    ...students.map((row) => ({
      type: 'student' as const,
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      subtitle: row.email,
      href: `/admin/students/${row.id}`,
    })),
    ...instructors.map((row) => ({
      type: 'instructor' as const,
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      subtitle: row.email,
      href: `/admin/instructors/${row.id}`,
    })),
    ...candidates.map((row) => ({
      type: 'candidate' as const,
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      subtitle: row.email,
      // Candidates have no detail page; deep-link the directory's selection.
      href: `/admin/leads?candidate=${row.id}`,
    })),
  ];
}
