import type { VIDEO_MP4_UNAVAILABLE_REASONS } from "./bunnyStream.constants";
import type { Readable } from "node:stream";

export type BunnyMp4FallbackResolution = 720 | 480 | 360 | 240;

export type BunnyVideoDetails = {
  guid: string;
  title: string;
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

export type VideoMp4UnavailableReason =
  (typeof VIDEO_MP4_UNAVAILABLE_REASONS)[keyof typeof VIDEO_MP4_UNAVAILABLE_REASONS];
