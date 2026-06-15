import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

export const projectRoot = process.cwd();
export const runtimeDirectory = path.join(projectRoot, '.data', 'runtime');
export const devLockPath = path.join(runtimeDirectory, 'next-dev.pid');

export async function readDevPid() {
  try {
    const value = await readFile(devLockPath, 'utf8');
    const pid = Number.parseInt(value.trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

export function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export async function getActiveDevPid() {
  const pid = await readDevPid();

  if (!pid || !isProcessRunning(pid)) {
    await rm(devLockPath, { force: true });
    return undefined;
  }

  return pid;
}
