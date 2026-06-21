import 'server-only';

import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  MediaSandboxResult,
  MediaSandboxTask,
} from '@/lib/media-sandbox-contract';
import { getRuntimeEnv } from '@/lib/server/env';
import { probeImage, probeVideo, runProcess } from './probe';

export async function processVideoInSandbox(task: MediaSandboxTask) {
  const env = getRuntimeEnv();

  if (env.FFMPEG_SANDBOX_MODE === 'direct') {
    return processDirect(task);
  }

  const root = path.resolve(env.MEDIA_JOB_ROOT);
  const inbox = path.join(root, 'inbox');
  const processing = path.join(root, 'processing');
  const results = path.join(root, 'results');
  await Promise.all([
    mkdir(inbox, { recursive: true }),
    mkdir(processing, { recursive: true }),
    mkdir(results, { recursive: true }),
  ]);

  const taskId = `${task.mediaId}-${task.generation}`;
  const temporary = path.join(inbox, `.${taskId}.${process.pid}.json`);
  const taskPath = path.join(inbox, `${taskId}.json`);
  const processingPath = path.join(processing, `${taskId}.json`);
  const resultPath = path.join(results, `${taskId}.json`);

  const taskExists =
    (await exists(taskPath)) ||
    (await exists(processingPath));

  if (!taskExists) {
    await unlink(resultPath).catch(() => undefined);
    await writeFile(temporary, JSON.stringify(task), { mode: 0o660 });
    await rename(temporary, taskPath);
  }

  const deadline = Date.now() + env.FFMPEG_JOB_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const result = JSON.parse(
        await readFile(resultPath, 'utf8'),
      ) as MediaSandboxResult;
      await unlink(resultPath).catch(() => undefined);

      if (
        result.mediaId !== task.mediaId ||
        result.generation !== task.generation
      ) {
        throw new Error('Sandbox result generation did not match the task.');
      }

      if (!result.ok) {
        throw new Error(result.error ?? 'Sandboxed FFmpeg failed.');
      }

      if (
        !result.durationSeconds ||
        !result.width ||
        !result.height
      ) {
        throw new Error('Sandboxed FFmpeg returned incomplete media metadata.');
      }

      return {
        durationSeconds: result.durationSeconds,
        height: result.height,
        width: result.width,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Sandboxed FFmpeg timed out.');
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processDirect(task: MediaSandboxTask) {
  const env = getRuntimeEnv();
  const source = await probeVideo(task.inputPath);
  await runProcess(
    env.FFMPEG_PATH,
    videoArgs(task.inputPath, task.outputPath),
    env.FFMPEG_JOB_TIMEOUT_MS,
  );
  await runProcess(
    env.FFMPEG_PATH,
    thumbnailArgs(
      task.inputPath,
      task.thumbnailPath,
      thumbnailSeek(source.durationSeconds),
    ),
    Math.min(env.FFMPEG_JOB_TIMEOUT_MS, 120_000),
  );
  return probeVideo(task.outputPath);
}

export function videoArgs(inputPath: string, outputPath: string) {
  return [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-map_metadata',
    '-1',
    '-sn',
    '-dn',
    '-vf',
    "scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease",
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '24',
    '-maxrate',
    '2500k',
    '-bufsize',
    '5000k',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

export function thumbnailArgs(
  inputPath: string,
  outputPath: string,
  seekSeconds = 1,
) {
  return [
    '-y',
    '-ss',
    seekSeconds.toFixed(3),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-2',
    outputPath,
  ];
}

function thumbnailSeek(durationSeconds: number) {
  return Math.max(0, Math.min(1, durationSeconds / 2));
}

// Images are processed via the in-worker direct path (libwebp is unavailable,
// so output is JPEG). Downscale to fit a 1920px box (no upscaling), strip
// metadata/EXIF, re-encode at high quality.
export function imageArgs(inputPath: string, outputPath: string) {
  return [
    '-y',
    '-i',
    inputPath,
    '-map_metadata',
    '-1',
    '-frames:v',
    '1',
    '-vf',
    "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease",
    '-q:v',
    '4',
    outputPath,
  ];
}

export async function processImageInSandbox(task: {
  inputPath: string;
  outputPath: string;
}) {
  const env = getRuntimeEnv();
  await probeImage(task.inputPath);
  await runProcess(
    env.FFMPEG_PATH,
    imageArgs(task.inputPath, task.outputPath),
    Math.min(env.FFMPEG_JOB_TIMEOUT_MS, 120_000),
  );
  return probeImage(task.outputPath);
}
