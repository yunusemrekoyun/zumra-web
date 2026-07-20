'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const DEFAULT_CITY_ZONES = [
  'Europe/Istanbul',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/London',
  'America/New_York',
];

function zoneCity(zone: string) {
  const city = zone.split('/').pop() ?? zone;
  return city.replaceAll('_', ' ');
}

function timeIn(zone: string, at: Date) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(at);
  } catch {
    return '--:--';
  }
}

function dayKeyIn(zone: string, at: Date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: zone,
      year: 'numeric',
    }).format(at);
  } catch {
    return '';
  }
}

// Compact world-clock strip: the academy's reference clock (Istanbul) plus the
// diaspora cities lessons are usually scheduled around, and the viewer's own
// timezone when it differs. Display-only.
export function WorldClock({
  title,
  viewerTimezone,
}: {
  title: string;
  viewerTimezone?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const zones = [...DEFAULT_CITY_ZONES];
  if (viewerTimezone && !zones.includes(viewerTimezone)) {
    zones.splice(1, 0, viewerTimezone);
  }
  const istanbulDay = dayKeyIn(APP_TIME_ZONE, now);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-black/[0.02] bg-white p-3 shadow-sm">
      <span className="inline-flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/40">
        <Clock3 className="h-4 w-4 text-[#533089]" />
        {title}
      </span>
      {zones.map((zone) => {
        const highlight =
          zone === viewerTimezone && viewerTimezone !== APP_TIME_ZONE;
        const reference = zone === APP_TIME_ZONE;
        const dayDiffers = dayKeyIn(zone, now) !== istanbulDay;
        return (
          <span
            key={zone}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold',
              reference
                ? 'bg-[#533089] text-white shadow-sm'
                : highlight
                  ? 'bg-[#533089]/10 text-[#533089]'
                  : 'bg-[#F8F9FC] text-[#2E286C]/65',
            )}
          >
            {zoneCity(zone)}
            <span className="font-black tabular-nums">
              {timeIn(zone, now)}
            </span>
            {dayDiffers ? <span className="text-[9px] opacity-70">±1g</span> : null}
          </span>
        );
      })}
    </div>
  );
}
