import { HOSTED_VIDEO_COPY_TITLE_MARKER } from "./hosted-video.constants";

import type { UUIDType } from "src/common";

/** The marker lets a copy find its provider video again when the create response was lost. */
export function buildHostedVideoCopyTitle(title: string, hostedVideoId: UUIDType): string {
  return `${title} - ${buildHostedVideoCopyMarker(hostedVideoId)}`;
}

export function buildHostedVideoCopyMarker(hostedVideoId: UUIDType): string {
  return `${HOSTED_VIDEO_COPY_TITLE_MARKER} ${hostedVideoId}`;
}
