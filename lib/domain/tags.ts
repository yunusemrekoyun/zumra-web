export function normalizeTag(value: string, maxLength = 100) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= maxLength
    ? normalized
    : undefined;
}

export function appendUniqueTag(
  current: string[],
  value: string,
  options: { locale?: string; maxLength?: number; maxTags?: number } = {},
) {
  const { locale = 'tr', maxLength = 100, maxTags = 30 } = options;
  const tag = normalizeTag(value, maxLength);
  if (
    !tag ||
    current.length >= maxTags ||
    current.some(
      (item) =>
        item.toLocaleLowerCase(locale) === tag.toLocaleLowerCase(locale),
    )
  ) {
    return current;
  }
  return [...current, tag];
}
