import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// Admin-editable legal / policy pages (KVKK, gizlilik, kullanım koşulları,
// çerez politikası, …). Content is sanitized HTML authored in the admin WYSIWYG
// editor and rendered on the public `/[slug]` route. Bilingual: tr is primary,
// en falls back to tr when empty. Staff manage the set entirely — new pages can
// be created without a code change.
export const legalPages = pgTable(
  'legal_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    titleTr: text('title_tr').notNull(),
    titleEn: text('title_en').notNull().default(''),
    // Sanitized HTML (sanitize-html on write). Never store raw editor output.
    bodyTr: text('body_tr').notNull().default(''),
    bodyEn: text('body_en').notNull().default(''),
    published: boolean('published').notNull().default(false),
    showInFooter: boolean('show_in_footer').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, {
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
    index('legal_pages_footer_idx').on(
      table.published,
      table.showInFooter,
      table.sortOrder,
    ),
  ],
);
