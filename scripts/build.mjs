import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  getActiveDevPid,
  projectRoot,
} from './next-runtime.mjs';

const activeDevPid = await getActiveDevPid();

if (activeDevPid) {
  console.error(
    `Zümra development server is running (PID ${activeDevPid}). ` +
      'Stop it before running a production build.',
  );
  process.exit(1);
}

const nextBinary = path.join(
  projectRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);
const child = spawn(
  process.execPath,
  [nextBinary, 'build', ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
