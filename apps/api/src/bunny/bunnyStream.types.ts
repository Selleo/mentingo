import type { Readable } from "node:stream";

export type BunnyMp4FallbackResolution = 720 | 480 | 360 | 240;

export type BunnyMp4DownloadResult = {
  stream: Readable;
  contentType: string;
  filename: string;
  resolution: BunnyMp4FallbackResolution;
};
