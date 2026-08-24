import type { Readable } from "node:stream";

export type BunnyMp4FallbackResolution = 720 | 480 | 360 | 240;

export type BunnyVideoDetails = {
  guid: string;
  length: number;
  status: number;
  [key: string]: unknown;
};

export type BunnyConfig = {
  apiKey: string;
  readOnlyApiKey: string;
  libraryId: string;
  cdnUrl: string | null;
  tokenSigningKey: string;
};

export type BunnyMp4DownloadResult = {
  stream: Readable;
  contentType: string;
  filename: string;
  resolution: BunnyMp4FallbackResolution;
};
