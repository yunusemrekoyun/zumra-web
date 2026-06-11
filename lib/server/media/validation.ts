import 'server-only';

import { createReadStream } from 'node:fs';
import { stat, statfs } from 'node:fs/promises';
import net from 'node:net';
import { fileTypeFromFile } from 'file-type';
import { getRuntimeEnv } from '@/lib/server/env';
import {
  UnsafeMediaError,
  UnsupportedMediaTypeError,
} from '@/lib/server/http/errors';
import { mediaRoot } from './paths';

const allowedMimeTypes = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['video/mp4', 'video'],
  ['video/quicktime', 'video'],
  ['video/webm', 'video'],
  ['application/pdf', 'document'],
  ['audio/mpeg', 'audio'],
  ['audio/wav', 'audio'],
]);

export async function inspectUploadedFile(
  filePath: string,
  expectedKind: string,
) {
  const [detected, fileStat] = await Promise.all([
    fileTypeFromFile(filePath),
    stat(filePath),
  ]);

  if (!detected) {
    throw new UnsupportedMediaTypeError();
  }

  const kind = allowedMimeTypes.get(detected.mime);

  if (!kind || kind !== expectedKind) {
    throw new UnsupportedMediaTypeError();
  }

  return {
    extension: detected.ext,
    kind,
    mimeType: detected.mime,
    sizeBytes: fileStat.size,
  };
}

export async function assertUploadCapacity() {
  const env = getRuntimeEnv();
  const stats = await statfs(mediaRoot());
  const used = stats.blocks - stats.bfree;
  const percent = stats.blocks === 0 ? 100 : (used / stats.blocks) * 100;

  if (percent >= env.MEDIA_DISK_BLOCK_PERCENT) {
    throw new Error('Media storage is above the upload safety threshold.');
  }

  return {
    percent,
    warning: percent >= env.MEDIA_DISK_WARN_PERCENT,
  };
}

export async function scanWithClamAv(filePath: string) {
  const env = getRuntimeEnv();

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
    });
    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
    let response = '';
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      stream.destroy();
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(60_000, () => fail(new Error('ClamAV scan timed out.')));
    socket.on('error', fail);
    socket.on('data', (chunk) => {
      response = `${response}${chunk.toString('utf8')}`.slice(-16_000);
    });
    socket.on('end', () => {
      if (settled) {
        return;
      }

      if (response.includes('FOUND')) {
        fail(new UnsafeMediaError());
        return;
      }

      if (!response.includes('OK')) {
        fail(new Error('ClamAV returned an invalid scan result.'));
        return;
      }

      settled = true;
      resolve();
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      stream.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(buffer.length);
        const sizeWritable = socket.write(size);
        const bufferWritable = socket.write(buffer);
        const writable = sizeWritable && bufferWritable;

        if (!writable) {
          stream.pause();
          socket.once('drain', () => stream.resume());
        }
      });
      stream.on('error', fail);
      stream.on('end', () => {
        const end = Buffer.alloc(4);
        end.writeUInt32BE(0);
        socket.end(end);
      });
    });
  });
}
