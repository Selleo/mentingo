import type { ResourceMetadata } from "./types/resource-metadata.type";
import type { VideoMetadataJobData } from "src/queue/queue.types";

export class VideoMetadataRetryableError extends Error {}

export type ProbeOutput = {
  format?: { duration?: string | number };
  streams?: Array<{ duration?: string | number }>;
};

export type VideoMetadataResource = {
  id: string;
  reference: string;
  metadata: ResourceMetadata | null;
};

export type VideoMetadataEnqueueParams = Pick<
  VideoMetadataJobData,
  "tenantId" | "resourceId" | "uploadId" | "provider" | "fileKey" | "bunnyVideoId"
>;
