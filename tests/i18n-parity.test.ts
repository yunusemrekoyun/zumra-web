import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function keys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [prefix];
  }

  if (!value || typeof value !== 'object') {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation catalog', () => {
  it('keeps Turkish and English message keys equal', async () => {
    const [tr, en] = await Promise.all([
      readFile('messages/tr.json', 'utf8').then(JSON.parse),
      readFile('messages/en.json', 'utf8').then(JSON.parse),
    ]);

    expect(keys(tr).sort()).toEqual(keys(en).sort());
  });
});
