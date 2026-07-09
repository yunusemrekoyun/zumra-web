import 'server-only';

import { and, asc, eq, ne } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import { database } from '@/lib/server/db/client';
import { legalPages } from '@/lib/server/db/schema';

export type LegalLocale = 'tr' | 'en';

// Slugs that already belong to app routes — a legal page here would be shadowed
// by the static route and never render, so we refuse them.
const RESERVED_SLUGS = new Set([
  'admin', 'danisman', 'ogrenci', 'ogretmen', 'giris', 'api', '_next',
  'level-test', 'seviye-testi', 'mfa', 'mfa-kurulum', 'cihaz-dogrulama',
  'aktivasyon', 'google-tamamla', 'sifre-sifirla', 'sifremi-unuttum',
  'ders-baglanti', 'yetkisiz', 'ozel-ders',
]);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'u',
    's', 'blockquote', 'br', 'hr', 'img', 'figure', 'figcaption', 'span',
    'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Force external links to open safely.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

/** Strip anything unsafe from admin-authored HTML before it is stored. */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeHtml(html ?? '', SANITIZE_OPTIONS);
}

const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

export function slugifyLegal(input: string): string {
  const ascii = Array.from(input.trim())
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return ascii || 'sayfa';
}

function localized<T extends { titleTr: string; titleEn: string }>(
  row: T,
  locale: LegalLocale,
): string {
  return locale === 'en' && row.titleEn.trim() ? row.titleEn : row.titleTr;
}

// ---------------------------------------------------------------------------
// Public reads (published only)
// ---------------------------------------------------------------------------

export type PublicLegalPage = { slug: string; title: string; bodyHtml: string };

export async function getPublishedLegalPage(
  slug: string,
  locale: LegalLocale,
): Promise<PublicLegalPage | null> {
  const [row] = await database
    .select()
    .from(legalPages)
    .where(and(eq(legalPages.slug, slug), eq(legalPages.published, true)))
    .limit(1);

  if (!row) {
    return null;
  }

  const bodyHtml =
    locale === 'en' && row.bodyEn.trim() ? row.bodyEn : row.bodyTr;

  return { slug: row.slug, title: localized(row, locale), bodyHtml };
}

export type FooterLegalLink = { slug: string; title: string };

export async function listFooterLegalPages(
  locale: LegalLocale,
): Promise<FooterLegalLink[]> {
  const rows = await database
    .select({
      slug: legalPages.slug,
      titleTr: legalPages.titleTr,
      titleEn: legalPages.titleEn,
    })
    .from(legalPages)
    .where(
      and(eq(legalPages.published, true), eq(legalPages.showInFooter, true)),
    )
    .orderBy(asc(legalPages.sortOrder), asc(legalPages.titleTr));

  return rows.map((row) => ({ slug: row.slug, title: localized(row, locale) }));
}

// ---------------------------------------------------------------------------
// Admin reads + mutations
// ---------------------------------------------------------------------------

export type AdminLegalPage = {
  id: string;
  slug: string;
  titleTr: string;
  titleEn: string;
  bodyTr: string;
  bodyEn: string;
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
  updatedAt: string;
};

function toAdmin(row: typeof legalPages.$inferSelect): AdminLegalPage {
  return {
    id: row.id,
    slug: row.slug,
    titleTr: row.titleTr,
    titleEn: row.titleEn,
    bodyTr: row.bodyTr,
    bodyEn: row.bodyEn,
    published: row.published,
    showInFooter: row.showInFooter,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminLegalPages(): Promise<AdminLegalPage[]> {
  const rows = await database
    .select()
    .from(legalPages)
    .orderBy(asc(legalPages.sortOrder), asc(legalPages.titleTr));
  return rows.map(toAdmin);
}

export async function getAdminLegalPage(
  id: string,
): Promise<AdminLegalPage | null> {
  const [row] = await database
    .select()
    .from(legalPages)
    .where(eq(legalPages.id, id))
    .limit(1);
  return row ? toAdmin(row) : null;
}

export class LegalPageError extends Error {
  constructor(public code: 'slug_reserved' | 'slug_taken' | 'not_found') {
    super(code);
    this.name = 'LegalPageError';
  }
}

async function slugTaken(slug: string, ignoreId?: string): Promise<boolean> {
  const [clash] = await database
    .select({ id: legalPages.id })
    .from(legalPages)
    .where(
      ignoreId
        ? and(eq(legalPages.slug, slug), ne(legalPages.id, ignoreId))
        : eq(legalPages.slug, slug),
    )
    .limit(1);
  return Boolean(clash);
}

// `userProvided` = the admin typed the slug explicitly (vs it being derived
// from the title). A collision on a user-typed slug is an error to report;
// a collision on an auto-derived slug is silently disambiguated with a suffix.
async function resolveUniqueSlug(
  desired: string,
  userProvided: boolean,
  ignoreId?: string,
): Promise<string> {
  const base = slugifyLegal(desired);
  if (RESERVED_SLUGS.has(base)) {
    throw new LegalPageError('slug_reserved');
  }

  if (!(await slugTaken(base, ignoreId))) {
    return base;
  }
  if (userProvided) {
    throw new LegalPageError('slug_taken');
  }

  let suffix = 1;
  for (;;) {
    suffix += 1;
    const candidate = `${base}-${suffix}`;
    if (!(await slugTaken(candidate, ignoreId))) {
      return candidate;
    }
  }
}

export type CreateLegalPageInput = {
  slug?: string;
  titleTr: string;
  titleEn?: string;
  bodyTr?: string;
  bodyEn?: string;
  published?: boolean;
  showInFooter?: boolean;
  sortOrder?: number;
};

export async function createLegalPage(
  input: CreateLegalPageInput,
  userId: string,
): Promise<AdminLegalPage> {
  const slug = await resolveUniqueSlug(
    input.slug || input.titleTr,
    Boolean(input.slug),
  );
  const [row] = await database
    .insert(legalPages)
    .values({
      slug,
      titleTr: input.titleTr.trim(),
      titleEn: (input.titleEn ?? '').trim(),
      bodyTr: sanitizeLegalHtml(input.bodyTr ?? ''),
      bodyEn: sanitizeLegalHtml(input.bodyEn ?? ''),
      published: input.published ?? false,
      showInFooter: input.showInFooter ?? true,
      sortOrder: input.sortOrder ?? 0,
      updatedByUserId: userId,
    })
    .returning();
  return toAdmin(row);
}

export type UpdateLegalPageInput = Partial<CreateLegalPageInput>;

export async function updateLegalPage(
  id: string,
  input: UpdateLegalPageInput,
  userId: string,
): Promise<AdminLegalPage> {
  const patch: Partial<typeof legalPages.$inferInsert> = {
    updatedByUserId: userId,
    updatedAt: new Date(),
  };

  if (input.slug !== undefined) {
    patch.slug = await resolveUniqueSlug(input.slug, true, id);
  }
  if (input.titleTr !== undefined) patch.titleTr = input.titleTr.trim();
  if (input.titleEn !== undefined) patch.titleEn = input.titleEn.trim();
  if (input.bodyTr !== undefined) patch.bodyTr = sanitizeLegalHtml(input.bodyTr);
  if (input.bodyEn !== undefined) patch.bodyEn = sanitizeLegalHtml(input.bodyEn);
  if (input.published !== undefined) patch.published = input.published;
  if (input.showInFooter !== undefined) patch.showInFooter = input.showInFooter;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const [row] = await database
    .update(legalPages)
    .set(patch)
    .where(eq(legalPages.id, id))
    .returning();

  if (!row) {
    throw new LegalPageError('not_found');
  }
  return toAdmin(row);
}

export async function deleteLegalPage(id: string): Promise<void> {
  await database.delete(legalPages).where(eq(legalPages.id, id));
}
