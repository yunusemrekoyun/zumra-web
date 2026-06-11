import { z } from 'zod';
import { ExternalIdentityError } from '@/lib/server/http/errors';

const googleProfileSchema = z.object({
  email: z.string().email(),
  email_verified: z.literal(true),
  family_name: z.string().optional(),
  given_name: z.string().optional(),
  locale: z.string().min(1).max(32).optional(),
  name: z.string().min(1).max(200),
  picture: z.string().url().optional(),
  sub: z.string().min(1).max(255),
});

export type VerifiedGoogleProfile = z.infer<typeof googleProfileSchema>;

export class GoogleProfileValidationError extends ExternalIdentityError {
  constructor() {
    super('Google profile could not be verified.');
    this.name = 'GoogleProfileValidationError';
  }
}

export function validateGoogleProfileForStudent(
  profile: unknown,
  studentEmail: string,
) {
  const parsed = googleProfileSchema.safeParse(profile);

  if (
    !parsed.success ||
    parsed.data.email.toLocaleLowerCase('en-US') !==
      studentEmail.toLocaleLowerCase('en-US')
  ) {
    throw new GoogleProfileValidationError();
  }

  return parsed.data;
}
