import { CalendarPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function AddPrivateLessonButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#533089] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-[#533089]/20 transition-colors hover:bg-[#462878]"
    >
      <CalendarPlus className="h-4 w-4" />
      {label}
    </Link>
  );
}
