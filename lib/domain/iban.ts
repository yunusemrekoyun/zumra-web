const TR_IBAN_LENGTH = 26;

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

// ISO 13616 mod-97 check over the rearranged IBAN. Digits are folded chunk by
// chunk so the intermediate number never exceeds Number.MAX_SAFE_INTEGER.
function mod97(numeric: string) {
  let remainder = 0;
  for (let index = 0; index < numeric.length; index += 7) {
    remainder = Number(`${remainder}${numeric.slice(index, index + 7)}`) % 97;
  }
  return remainder;
}

export function isValidTurkishIban(value: string) {
  const normalized = normalizeIban(value);

  if (!/^TR\d{24}$/.test(normalized) || normalized.length !== TR_IBAN_LENGTH) {
    return false;
  }

  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, (letter) =>
    String(letter.charCodeAt(0) - 55),
  );

  return mod97(numeric) === 1;
}

/** Groups an IBAN into blocks of four for display: TR12 3456 ... */
export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}

export function maskIban(lastFour: string | null) {
  if (!lastFour) {
    return null;
  }

  return `TR** **** **** ${lastFour}`;
}
