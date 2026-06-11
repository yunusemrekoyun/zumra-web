import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const repositoryFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
  encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

const forbidden = [
  /^\.env(?:\.|$)/,
  /(^|\/)\.data\//,
  /^(?:backup|backups|releases|runtime|shared)\//,
  /\.(?:pem|key|p12|pfx)$/i,
];

const pathViolations = repositoryFiles.filter((file) =>
  forbidden.some((pattern) => pattern.test(file)),
);

if (pathViolations.length > 0) {
  console.error(`Repository contains sensitive paths:\n${pathViolations.join('\n')}`);
  process.exit(1);
}

const secretSignatures = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
];
const contentViolations: string[] = [];

for (const file of repositoryFiles) {
  let fileStat;

  try {
    fileStat = statSync(file);
  } catch {
    continue;
  }

  if (!fileStat.isFile() || fileStat.size > 2 * 1024 * 1024) {
    continue;
  }

  let content;

  try {
    content = readFileSync(file);
  } catch {
    continue;
  }

  if (content.includes(0)) {
    continue;
  }

  const text = content.toString('utf8');

  if (secretSignatures.some((pattern) => pattern.test(text))) {
    contentViolations.push(file);
  }
}

if (contentViolations.length > 0) {
  console.error(
    `Potential secret signatures found:\n${contentViolations.join('\n')}`,
  );
  process.exit(1);
}

console.log(
  `Secret scan passed (${repositoryFiles.length} tracked and untracked repository files).`,
);
