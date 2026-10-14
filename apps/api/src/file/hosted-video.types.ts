import type { HOSTED_VIDEO_STATUSES } from "./hosted-video.constants";
import type { VideoProviderType } from "@repo/shared";
import type { Readable } from "node:stream";
import type { UUIDType } from "src/common";
import type { hostedVideos } from "src/storage/schema";

export type HostedVideoStatus = (typeof HOSTED_VIDEO_STATUSES)[keyof typeof HOSTED_VIDEO_STATUSES];

export type HostedVideo = typeof hostedVideos.$inferSelect;

export interface HostedVideoCopyIdentity {
  tenantId: UUIDType;
  provider: VideoProviderType;
  providerConfigurationSignature: string;
  copiedFromTenantId: UUIDType;
  copiedFromReference: string;
}

export interface HostedVideoSourceStream {
  stream: Readable;
  contentType: string;
}

export interface HostedVideoCopyRequest {
  sourceTenantId: UUIDType;
  sourceReference: string;
  targetTenantId: UUIDType;
  title: string;
  openSourceVideo: () => Promise<HostedVideoSourceStream>;
}
