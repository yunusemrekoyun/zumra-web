import { Calendar } from 'lucide-react';
import { WorkspaceEmptyDashboard } from '@/components/ui';
import {
  getVisibleLeads,
  getVisibleStudents,
  workspaceMeetings,
  workspaceOffers,
  workspaceUsers,
} from '@/lib/domain';

export default function AdvisorDashboardPage() {
  const advisor = workspaceUsers.find((user) => user.role === 'advisor');
  const leads = advisor ? getVisibleLeads(advisor) : [];
  const students = advisor ? getVisibleStudents(advisor) : [];
  const meetings = advisor
    ? workspaceMeetings.filter((meeting) => meeting.advisorId === advisor.id)
    : [];
  const offers = advisor
    ? workspaceOffers.filter((offer) => offer.advisorId === advisor.id)
    : [];

  return (
    <WorkspaceEmptyDashboard
      icon={Calendar}
      title="Danışman Paneli"
      description="Atanan leadler, öğrenciler, görüşmeler ve teklifler için CRM akışının temel kabuğu hazır."
      moduleTitle="Danışman Modülleri"
      metrics={[
        { label: 'Leadlerim', value: leads.length },
        { label: 'Öğrencilerim', value: students.length },
        { label: 'Görüşmeler', value: meetings.length },
        { label: 'Teklifler', value: offers.length },
      ]}
    />
  );
}
