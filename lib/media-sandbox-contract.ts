export type MediaSandboxTask = {
  generation: number;
  inputPath: string;
  mediaId: string;
  outputPath: string;
  thumbnailPath: string;
};

export type MediaSandboxResult = {
  durationSeconds?: number;
  error?: string;
  generation: number;
  height?: number;
  mediaId: string;
  ok: boolean;
  width?: number;
};
