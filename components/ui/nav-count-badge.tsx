import { cn } from '@/lib/utils';

export function NavCountBadge({
  count,
  className,
}: {
  count?: number;
  className?: string;
}) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        'flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
