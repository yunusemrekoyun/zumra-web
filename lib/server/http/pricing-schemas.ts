import 'server-only';

import { z } from 'zod';
import { supportedProgramLanguages } from '@/lib/server/services/programs';

export const discountPackageSchema = z
  .object({
    active: z.boolean().optional(),
    branchId: z.string().uuid().nullable().optional(),
    discountType: z.enum(['percentage', 'fixed']),
    // Fixed discounts are cents; 100M cents = 1M TL is far beyond any course.
    discountValue: z.number().int().positive().max(100_000_000),
    endsAt: z.string().datetime().nullable().optional(),
    name: z.string().trim().min(2).max(120),
    note: z.string().trim().max(300).nullable().optional(),
    scope: z.enum(['branch', 'private']),
    startsAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (value) =>
      value.scope === 'branch' ? Boolean(value.branchId) : !value.branchId,
    { message: 'scope_target_mismatch' },
  );

export const lessonPackageSchema = z.object({
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
  hourlyPriceCents: z.number().int().positive().max(100_000_000),
  hours: z.number().int().min(1).max(1000),
  language: z.enum(supportedProgramLanguages),
  name: z.string().trim().min(2).max(120),
  note: z.string().trim().max(300).nullable().optional(),
  totalPriceCents: z.number().int().positive().max(100_000_000),
});
