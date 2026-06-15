import { spawn } from 'node:child_process';
import {
  mkdir,
  open,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import {
  devLockPath,
  getActiveDevPid,
  projectRoot,
  readDevPid,
  runtimeDirectory,
} from './next-runtime.mjs';

const nextBinary = path.join(
  projectRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

await mkdir(runtimeDirectory, { recursive: true });
const activeDevPid = await getActiveDevPid();

let lock;
try {
  lock = await open(devLockPath, 'wx', 0o600);
} catch (error) {
  if (error?.code === 'EEXIST') {
    console.error(
      `Zümra development server is already running${
        activeDevPid ? ` (PID ${activeDevPid})` : ''
      }. Stop it before starting another instance.`,
    );
    process.exit(1);
  }
  throw error;
}

await lock.writeFile(`${process.pid}\n`);
await lock.close();

await rm(path.join(projectRoot, '.next-dev'), {
  force: true,
  recursive: true,
});

const child = spawn(
  process.execPath,
  [nextBinary, 'dev', ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      NEXT_DIST_DIR: '.next-dev',
    },
    stdio: 'inherit',
  },
);

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    child.kill(signal);
  });
}

child.on('error', async (error) => {
  await releaseLock();
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', async (code, signal) => {
  await releaseLock();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

async function releaseLock() {
  const pid = await readDevPid();
  if (pid === process.pid) {
    await rm(devLockPath, { force: true });
  }
}
