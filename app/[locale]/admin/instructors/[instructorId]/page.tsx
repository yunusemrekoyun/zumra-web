import { notFound } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getInstructorProfile } from '@/lib/server/services/instructors';
import { InstructorProfileClient } from './instructor-profile-client';

type InstructorProfilePageProps = {
  params: Promise<{ instructorId: string; locale: string }>;
};

export default async function InstructorProfilePage({
  params,
}: InstructorProfilePageProps) {
  const { instructorId, locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const instructor = await getInstructorProfile(principal, instructorId);
  if (!instructor) notFound();

  return <InstructorProfileClient initial={instructor} locale={locale} />;
}
