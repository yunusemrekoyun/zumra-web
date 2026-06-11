import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type {
  MediaSandboxResult,
  MediaSandboxTask,
} from '../lib/media-sandbox-contract';

const mediaRoot = path.resolve(process.env.MEDIA_ROOT ?? '/data/media');
const jobRoot = path.resolve(process.env.MEDIA_JOB_ROOT ?? '/data/media-jobs');
const inbox = path.join(jobRoot, 'inbox');
const processing = path.join(jobRoot, 'processing');
const results = path.join(jobRoot, 'results');
const timeoutMs = Number(process.env.FFMPEG_JOB_TIMEOUT_MS ?? 900_000);
let stopping = false;

async function main() {
  await Promise.all(
    [inbox, processing, results].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await recoverInterruptedTasks();
  await removeStaleResults();

  process.once('SIGINT', () => {
    stopping = true;
  });
  process.once('SIGTERM', () => {
    stopping = true;
  });

  while (!stopping) {
    const taskName = (await readdir(inbox))
      .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
      .sort()[0];

    if (!taskName) {
      await sleep(500);
      continue;
    }

    const claimedPath = path.join(processing, taskName);
    const inboxPath = path.join(inbox, taskName);

    try {
      await rename(inboxPath, claimedPath);
    } catch {
      continue;
    }

    const taskId = taskName.slice(0, -5);
    const resultPath = path.join(results, taskName);
    let result: MediaSandboxResult;
    let task: MediaSandboxTask | undefined;

    try {
      task = JSON.parse(await readFile(claimedPath, 'utf8')) as MediaSandboxTask;
      validateTask(task);
      const source = await probeVideo(task.inputPath);
      await runFfmpeg(videoArgs(task.inputPath, task.outputPath));
      await runFfmpeg(
        thumbnailArgs(
          task.inputPath,
          task.thumbnailPath,
          thumbnailSeek(source.durationSeconds),
        ),
        120_000,
      );
      const output = await probeVideo(task.outputPath);
      result = {
        durationSeconds: output.durationSeconds,
        generation: task.generation,
        height: output.height,
        mediaId: task.mediaId,
        ok: true,
        width: output.width,
      };
    } catch (error) {
      result = {
        error: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        generation: task?.generation ?? 0,
        mediaId: task?.mediaId ?? taskId,
        ok: false,
      };
    }

    const temporaryResultPath = path.join(
      results,
      `.${taskName}.${process.pid}.tmp`,
    );
    await writeFile(temporaryResultPath, JSON.stringify(result), {
      mode: 0o660,
    });
    await rename(temporaryResultPath, resultPath);
    await unlink(claimedPath).catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Media processor failed.',
  );
  process.exitCode = 1;
});

function validateTask(task: MediaSandboxTask) {
  if (!Number.isInteger(task.generation) || task.generation < 1) {
    throw new Error('Sandbox task has an invalid generation.');
  }
  for (const filePath of [
    task.inputPath,
    task.outputPath,
    task.thumbnailPath,
  ]) {
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(`${mediaRoot}${path.sep}`)) {
      throw new Error('Sandbox task contains an invalid media path.');
    }
  }
}

async function recoverInterruptedTasks() {
  const taskNames = (await readdir(processing)).filter((name) =>
    name.endsWith('.json'),
  );

  for (const taskName of taskNames) {
    await rename(
      path.join(processing, taskName),
      path.join(inbox, taskName),
    ).catch(() => undefined);
  }
}

async function removeStaleResults() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const resultNames = (await readdir(results)).filter((name) =>
    name.endsWith('.json'),
  );

  for (const resultName of resultNames) {
    const resultPath = path.join(results, resultName);
    const fileStat = await stat(resultPath).catch(() => null);

    if (fileStat && fileStat.mtimeMs < cutoff) {
      await unlink(resultPath).catch(() => undefined);
    }
  }
}

function runFfmpeg(args: string[], limit = timeoutMs) {
  return runProcess(process.env.FFMPEG_PATH ?? 'ffmpeg', args, limit).then(
    () => undefined,
  );
}

async function probeVideo(filePath: string) {
  const output = await runProcess(
    process.env.FFPROBE_PATH ?? 'ffprobe',
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
    30_000,
  );
  const parsed = JSON.parse(output) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      height?: number;
      width?: number;
    }>;
  };
  const video = parsed.streams?.find(
    (stream) => stream.codec_type === 'video',
  );

  if (!video?.width || !video.height) {
    throw new Error('No valid video stream was found.');
  }

  if (
    video.width > 7680 ||
    video.height > 4320 ||
    video.width * video.height > 33_177_600
  ) {
    throw new Error('Video dimensions are outside the allowed range.');
  }

  const durationSeconds = Number(parsed.format?.duration ?? 0);

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 15 * 60
  ) {
    throw new Error('Video duration is outside the allowed range.');
  }

  return {
    durationSeconds,
    height: video.height,
    width: video.width,
  };
}

function runProcess(executable: string, args: string[], limit: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    };

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectOnce(new Error(`${executable} timed out.`));
    }, limit);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');

      if (stdout.length > 1024 * 1024) {
        child.kill('SIGKILL');
        rejectOnce(new Error(`${executable} returned too much output.`));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-8_000);
    });
    child.on('error', rejectOnce);
    child.on('close', (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        rejectOnce(
          new Error(`${executable} failed: ${stderr.slice(-1_000)}`),
        );
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(stdout);
    });
  });
}

function videoArgs(inputPath: string, outputPath: string) {
  return [
    '-y', '-i', inputPath, '-map', '0:v:0', '-map', '0:a?',
    '-map_metadata', '-1', '-sn', '-dn',
    '-vf', "scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-maxrate', '2500k', '-bufsize', '5000k',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputPath,
  ];
}

function thumbnailArgs(
  inputPath: string,
  outputPath: string,
  seekSeconds = 1,
) {
  return [
    '-y', '-ss', seekSeconds.toFixed(3), '-i', inputPath, '-frames:v', '1',
    '-vf', 'scale=640:-2', outputPath,
  ];
}

function thumbnailSeek(durationSeconds: number) {
  return Math.max(0, Math.min(1, durationSeconds / 2));
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
