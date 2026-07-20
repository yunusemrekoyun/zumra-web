import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// Pill switcher between a page's primary chat surface and the staff channel.
export function ChatModeTabs({
  active,
  basePath,
  primaryLabel,
  staffLabel,
}: {
  active: 'primary' | 'staff';
  basePath: string;
  primaryLabel: string;
  staffLabel: string;
}) {
  const pill = (isActive: boolean) =>
    cn(
      'rounded-full px-4 py-2 text-xs font-bold transition-colors',
      isActive
        ? 'bg-[#533089] text-white shadow-sm'
        : 'text-[#2E286C]/60 hover:bg-white',
    );

  return (
    <div className="mb-4 inline-flex gap-1 rounded-full bg-[#F8F9FC] p-1 shadow-inner shadow-black/[0.03]">
      <Link className={pill(active === 'primary')} href={basePath}>
        {primaryLabel}
      </Link>
      <Link className={pill(active === 'staff')} href={`${basePath}?tab=staff`}>
        {staffLabel}
      </Link>
    </div>
  );
}
