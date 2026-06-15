import { rm } from 'node:fs/promises';
import path from 'node:path';
import {
  getActiveDevPid,
  projectRoot,
} from './next-runtime.mjs';

const activeDevPid = await getActiveDevPid();

if (activeDevPid) {
  console.error(
    `Zümra development server is running (PID ${activeDevPid}). ` +
      'Stop it before cleaning Next.js build outputs.',
  );
  process.exit(1);
}

await Promise.all([
  rm(path.join(projectRoot, '.next'), { force: true, recursive: true }),
  rm(path.join(projectRoot, '.next-dev'), { force: true, recursive: true }),
]);

console.log('Next.js build outputs cleaned.');
