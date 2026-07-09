// Timezone helpers for datetime-local (`YYYY-MM-DDTHH:mm`) wall-clock values.
//
// The academy operates in a single timezone; all lesson/appointment times are
// entered and displayed as Istanbul wall-clock. A raw `new Date(local)` would
// interpret the value in the visitor's browser timezone, so an out-of-Istanbul
// staff member would shift the stored instant. These helpers pin the wall-clock
// to Europe/Istanbul (DST-aware via Intl) on both directions.

export const APP_TIME_ZONE = 'Europe/Istanbul';

function zonedParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  // Intl can emit hour "24" for midnight; normalize to 0.
  const hour = get('hour') % 24;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
  };
}

/** `YYYY-MM-DDTHH:mm` (interpreted as Istanbul wall-clock) -> UTC ISO string. */
export function istanbulWallClockToISO(local: string): string {
  const [datePart, timePart = '00:00'] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let ms = target;
  // Converge on the instant whose Istanbul wall-clock equals the input.
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(ms));
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    ms -= asUtc - target;
  }
  return new Date(ms).toISOString();
}

/** UTC ISO string -> `YYYY-MM-DDTHH:mm` Istanbul wall-clock (for pickers). */
export function isoToIstanbulWallClock(iso: string): string {
  const p = zonedParts(new Date(iso));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
