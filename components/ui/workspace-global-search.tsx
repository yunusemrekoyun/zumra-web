'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GraduationCap, Search, UserCheck, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type SearchResult = {
  type: 'student' | 'instructor' | 'candidate';
  id: string;
  name: string;
  subtitle?: string;
  href: string;
};

const typeIcons = {
  student: GraduationCap,
  instructor: UserCheck,
  candidate: Users,
} as const;

// Real global search behind the admin shell's header box: ⌘K focuses, typing
// queries /api/admin/search, picking a result navigates.
export function WorkspaceGlobalSearch({ placeholder }: { placeholder: string }) {
  const t = useTranslations('workspace.search');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(q)}`,
          { credentials: 'same-origin' },
        );
        const body = await response.json().catch(() => ({}));
        if (seq !== requestSeq.current) return;
        setResults(response.ok && body.results ? body.results : []);
      } catch {
        if (seq === requestSeq.current) setResults([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const pick = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery('');
      setResults([]);
      router.push(result.href as never);
    },
    [router],
  );

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div
      ref={containerRef}
      className="relative group hidden md:block w-full max-w-sm lg:w-96"
    >
      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#2E286C]/40 group-focus-within:text-[#533089] transition-colors" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-11 bg-white rounded-2xl pl-11 pr-4 outline-none text-sm placeholder:text-[#2E286C]/30 text-[#2E286C] shadow-sm border border-transparent focus:border-[#533089]/20 focus:shadow-md transition-all font-medium"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
        <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">
          ⌘
        </kbd>
        <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">
          K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-2 shadow-xl">
          {loading ? (
            <p className="px-3 py-4 text-sm font-medium text-[#2E286C]/40">
              {t('loading')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm font-medium text-[#2E286C]/40">
              {t('noResults')}
            </p>
          ) : (
            results.map((result) => {
              const Icon = typeIcons[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => pick(result)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#533089]/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8F9FC] text-[#533089]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#2E286C]">
                      {result.name}
                    </span>
                    {result.subtitle && (
                      <span className="block truncate text-xs font-medium text-[#2E286C]/40">
                        {result.subtitle}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      result.type === 'student' && 'bg-[#533089]/7 text-[#533089]',
                      result.type === 'instructor' && 'bg-blue-50 text-blue-700',
                      result.type === 'candidate' && 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {t(`types.${result.type}`)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
