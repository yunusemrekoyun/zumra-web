import 'server-only';

import { spawn } from 'node:child_process';
import { getRuntimeEnv } from '@/lib/server/env';

type ProbeOutput = {
  format?: {
    duration?: string;
  };
  streams?: Array<{
    codec_type?: string;
    height?: number;
    width?: number;
  }>;
};

export async function probeVideo(filePath: string) {
  const env = getRuntimeEnv();
  const output = await runProcess(env.FFPROBE_PATH, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ], 30_000);
  const parsed = JSON.parse(output) as ProbeOutput;
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

  const duration = Number(parsed.format?.duration ?? 0);

  if (!Number.isFinite(duration) || duration <= 0 || duration > 15 * 60) {
    throw new Error('Video duration is outside the allowed range.');
  }

  return {
    durationSeconds: duration,
    height: video.height,
    width: video.width,
  };
}

export async function probeImage(filePath: string) {
  const env = getRuntimeEnv();
  const output = await runProcess(
    env.FFPROBE_PATH,
    ['-v', 'error', '-print_format', 'json', '-show_streams', filePath],
    30_000,
  );
  const parsed = JSON.parse(output) as ProbeOutput;
  const image = parsed.streams?.find((stream) => stream.codec_type === 'video');

  if (!image?.width || !image.height) {
    throw new Error('No valid image stream was found.');
  }

  // Guard against decompression bombs before full decode.
  if (
    image.width > 20_000 ||
    image.height > 20_000 ||
    image.width * image.height > 100_000_000
  ) {
    throw new Error('Image dimensions are outside the allowed range.');
  }

  return { height: image.height, width: image.width };
}

export async function runProcess(
  executable: string,
  args: string[],
  timeoutMs: number,
) {
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
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');

      if (stdout.length > 1024 * 1024) {
        child.kill('SIGKILL');
        rejectOnce(new Error(`${executable} returned too much output.`));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendTail(stderr, chunk.toString('utf8'), 8_000);
    });
    child.on('error', (error) => {
      rejectOnce(error);
    });
    child.on('close', (code) => {
      if (settled) {
        return;
      }

      clearTimeout(timeout);

      if (code !== 0) {
        rejectOnce(new Error(`${executable} failed: ${stderr.slice(-1_000)}`));
        return;
      }

      settled = true;
      resolve(stdout);
    });
  });
}

function appendTail(current: string, chunk: string, limit: number) {
  return `${current}${chunk}`.slice(-limit);
}
