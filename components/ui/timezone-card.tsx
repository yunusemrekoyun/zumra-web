'use client';

import { useMemo, useState } from 'react';
import { Globe2, LocateFixed, Save } from 'lucide-react';
import { Button } from './button';
import { ModulePanel } from './module-panel';

export type TimezoneCardLabels = {
  badge: string;
  title: string;
  description: string;
  detect: string;
  save: string;
  saving: string;
  success: string;
  error: string;
  defaultHint: string;
};

// Common zones for the academy's audience (Türkiye + diaspora in Europe,
// North America and the Gulf). Anything else is reachable via browser detect.
const COMMON_TIMEZONES = [
  'Europe/Istanbul',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Paris',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/London',
  'Europe/Stockholm',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Baku',
  'Australia/Sydney',
];

function zoneCity(zone: string) {
  const city = zone.split('/').pop() ?? zone;
  return city.replaceAll('_', ' ');
}

function zoneOffsetLabel(zone: string, at: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(at);
    return (
      parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

export function TimezoneCard({
  currentTimezone,
  labels,
}: {
  currentTimezone: string;
  labels: TimezoneCardLabels;
}) {
  const [selected, setSelected] = useState(currentTimezone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  const zones = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    set.add(currentTimezone);
    if (selected) set.add(selected);
    const now = new Date();
    return Array.from(set)
      .map((zone) => ({
        label: `${zoneCity(zone)} (${zoneOffsetLabel(zone, now)})`,
        zone,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [currentTimezone, selected]);

  function detect() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) setSelected(zone);
    } catch {
      // keep current selection
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/me/timezone', {
        body: JSON.stringify({ timezone: selected }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('update_failed');
      setMessage({ text: labels.success, type: 'success' });
    } catch {
      setMessage({ text: labels.error, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
        <Globe2 className="h-4 w-4" />
        {labels.badge}
      </div>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {labels.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
        {labels.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select
          value={selected}
          disabled={busy}
          onChange={(event) => setSelected(event.target.value)}
          className="h-11 min-w-56 rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 text-sm font-semibold text-[#2E286C] outline-none transition-colors focus:border-[#533089]/30"
        >
          {zones.map((entry) => (
            <option key={entry.zone} value={entry.zone}>
              {entry.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={detect}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/7 disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" />
          {labels.detect}
        </button>
        <Button disabled={busy} onClick={() => void save()}>
          <Save className="h-4 w-4" />
          {busy ? labels.saving : labels.save}
        </Button>
      </div>

      <p className="mt-3 text-xs font-semibold text-[#2E286C]/45">
        {labels.defaultHint}
      </p>

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'mt-4 rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
              : 'mt-4 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </div>
      )}
    </ModulePanel>
  );
}
