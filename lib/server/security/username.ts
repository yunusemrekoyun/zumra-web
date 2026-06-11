const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);
  return (
    normalized.length >= 5 &&
    normalized.length <= 30 &&
    USERNAME_PATTERN.test(normalized)
  );
}

export function assertValidUsername(value: string) {
  const username = normalizeUsername(value);

  if (!isValidUsername(username)) {
    throw new Error(
      'Username must be 5-30 characters and use letters, numbers, dot, dash or underscore.',
    );
  }

  return username;
}
