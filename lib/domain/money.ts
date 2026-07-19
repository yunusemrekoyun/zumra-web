// Turkish-format money input: "6.000" and "6.000,50" use dots as thousands
// separators, while a lone "6.5" is a decimal. A naive parseFloat reads
// "6.000" as 6 lira — a 1000× accounting error — so parsing is strict:
// anything ambiguous returns null and the form must show an error.
export function parseTlToCents(value: string): number | null {
  const trimmed = value.trim().replace(/\s+/g, '').replace(/₺|tl/gi, '');

  if (!trimmed) {
    return null;
  }

  let normalized: string;

  if (trimmed.includes(',')) {
    // Comma is the decimal separator; dots can only be thousands groups.
    const [whole, fraction, extra] = trimmed.split(',');

    if (
      extra !== undefined ||
      !/^(\d{1,3}(\.\d{3})*|\d+)$/.test(whole) ||
      !/^\d{1,2}$/.test(fraction ?? '')
    ) {
      return null;
    }

    normalized = `${whole.replace(/\./g, '')}.${fraction}`;
  } else if (trimmed.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
      // Dot-grouped thousands: 6.000 → 6000 lira.
      normalized = trimmed.replace(/\./g, '');
    } else if (/^\d+\.\d{1,2}$/.test(trimmed)) {
      // Single dot with 1-2 digits reads as a decimal: 6.5 → 6,50 lira.
      normalized = trimmed;
    } else {
      return null;
    }
  } else if (/^\d+$/.test(trimmed)) {
    normalized = trimmed;
  } else {
    return null;
  }

  const cents = Math.round(Number.parseFloat(normalized) * 100);

  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatCents(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

/** Prefills amount inputs: cents → "6000,00" (no thousands separators). */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}
