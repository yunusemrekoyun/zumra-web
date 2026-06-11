export type ByteRange =
  | { end: number; start: number }
  | { invalid: true }
  | null;

export function parseByteRange(value: string | null, size: number): ByteRange {
  if (!value) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(value);

  if (!match || size <= 0 || (!match[1] && !match[2])) {
    return { invalid: true };
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);

    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { invalid: true };
    }

    return {
      end: size - 1,
      start: Math.max(size - suffixLength, 0),
    };
  }

  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > end ||
    start >= size
  ) {
    return { invalid: true };
  }

  return { end, start };
}
