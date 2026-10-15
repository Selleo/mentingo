import { VIDEO_PROCESSING_STATUSES } from "@repo/shared";

import { HOSTED_VIDEO_STATUSES } from "src/file/hosted-video.constants";
import {
  BUNNY_API_VIDEO_STATUSES,
  BUNNY_WEBHOOK_VIDEO_STATUSES,
} from "src/file/video-metadata.constants";

import type { HostedVideoStatus } from "src/file/hosted-video.types";

export const BUNNY_LIBRARIES = {
  SOURCE: "source-library",
  TARGET: "target-library",
} as const;

export const VIDEO_STORAGES = {
  S3: "s3",
  BUNNY: "bunny",
} as const;

export const VIDEO_COPY_OUTCOMES = {
  COPIED_WITHIN_STORAGE: "copied within storage",
  STREAMED_INTO_STORAGE: "streamed into storage",
  UPLOADED_TO_TARGET_LIBRARY: "uploaded to the target library",
  REUSED_SOURCE_VIDEO: "reused the source video",
} as const;

export type VideoStorage = (typeof VIDEO_STORAGES)[keyof typeof VIDEO_STORAGES];
export type VideoCopyOutcome = (typeof VIDEO_COPY_OUTCOMES)[keyof typeof VIDEO_COPY_OUTCOMES];
export type BunnyLibrary = (typeof BUNNY_LIBRARIES)[keyof typeof BUNNY_LIBRARIES] | null;

export type VideoRoute = {
  route: string;
  sourceStorage: VideoStorage;
  sourceLibrary: BunnyLibrary;
  targetLibrary: BunnyLibrary;
  outcome: VideoCopyOutcome;
};

export const LESSON_VIDEO_ROUTES: VideoRoute[] = [
  {
    route: "S3 to S3",
    sourceStorage: VIDEO_STORAGES.S3,
    sourceLibrary: null,
    targetLibrary: null,
    outcome: VIDEO_COPY_OUTCOMES.COPIED_WITHIN_STORAGE,
  },
  {
    route: "Bunny to S3",
    sourceStorage: VIDEO_STORAGES.BUNNY,
    sourceLibrary: BUNNY_LIBRARIES.SOURCE,
    targetLibrary: null,
    outcome: VIDEO_COPY_OUTCOMES.STREAMED_INTO_STORAGE,
  },
  {
    route: "S3 to Bunny",
    sourceStorage: VIDEO_STORAGES.S3,
    sourceLibrary: null,
    targetLibrary: BUNNY_LIBRARIES.TARGET,
    outcome: VIDEO_COPY_OUTCOMES.UPLOADED_TO_TARGET_LIBRARY,
  },
  {
    route: "Bunny to another Bunny library",
    sourceStorage: VIDEO_STORAGES.BUNNY,
    sourceLibrary: BUNNY_LIBRARIES.SOURCE,
    targetLibrary: BUNNY_LIBRARIES.TARGET,
    outcome: VIDEO_COPY_OUTCOMES.UPLOADED_TO_TARGET_LIBRARY,
  },
  {
    route: "Bunny to the same Bunny library",
    sourceStorage: VIDEO_STORAGES.BUNNY,
    sourceLibrary: BUNNY_LIBRARIES.SOURCE,
    targetLibrary: BUNNY_LIBRARIES.SOURCE,
    outcome: VIDEO_COPY_OUTCOMES.REUSED_SOURCE_VIDEO,
  },
];

export const WEBHOOK_STATUS_CASES: Array<{
  webhook: string;
  bunnyStatus: number;
  hostedStatus: HostedVideoStatus;
  placeholder: string | null;
}> = [
  {
    webhook: "encoding",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.ENCODING,
    hostedStatus: HOSTED_VIDEO_STATUSES.PROCESSING,
    placeholder: VIDEO_PROCESSING_STATUSES.PROCESSING,
  },
  {
    webhook: "finished",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.FINISHED,
    hostedStatus: HOSTED_VIDEO_STATUSES.READY,
    placeholder: null,
  },
  {
    webhook: "resolution finished",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.RESOLUTION_FINISHED,
    hostedStatus: HOSTED_VIDEO_STATUSES.READY,
    placeholder: null,
  },
  {
    webhook: "encoding failed",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.FAILED,
    hostedStatus: HOSTED_VIDEO_STATUSES.FAILED,
    placeholder: VIDEO_PROCESSING_STATUSES.FAILED,
  },
  {
    webhook: "pre-signed upload failed",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.PRESIGNED_UPLOAD_FAILED,
    hostedStatus: HOSTED_VIDEO_STATUSES.FAILED,
    placeholder: VIDEO_PROCESSING_STATUSES.FAILED,
  },
  {
    webhook: "captions generated",
    bunnyStatus: BUNNY_WEBHOOK_VIDEO_STATUSES.CAPTIONS_GENERATED,
    hostedStatus: HOSTED_VIDEO_STATUSES.PROCESSING,
    placeholder: VIDEO_PROCESSING_STATUSES.PROCESSING,
  },
];

export const PROVIDER_STATUS_CHECK_CASES: Array<{
  bunnyApiStatus: number;
  hostedStatus: HostedVideoStatus;
}> = [
  {
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.TRANSCODING,
    hostedStatus: HOSTED_VIDEO_STATUSES.PROCESSING,
  },
  { bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.FINISHED, hostedStatus: HOSTED_VIDEO_STATUSES.READY },
  { bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.ERROR, hostedStatus: HOSTED_VIDEO_STATUSES.FAILED },
  {
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.UPLOAD_FAILED,
    hostedStatus: HOSTED_VIDEO_STATUSES.FAILED,
  },
  {
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.JIT_PLAYLISTS_CREATED,
    hostedStatus: HOSTED_VIDEO_STATUSES.PROCESSING,
  },
];

export const MINUTE_MS = 60 * 1000;

export const STALE_UPLOAD_CASES: Array<{
  scenario: string;
  uploadAgeMinutes: number;
  hasProviderVideoId: boolean;
  isFoundByTitleMarker: boolean;
  bunnyApiStatus: number;
  hostedStatus: HostedVideoStatus;
  adoptsProviderVideo: boolean;
}> = [
  {
    scenario: "keeps an upload that may still be running",
    uploadAgeMinutes: 5,
    hasProviderVideoId: false,
    isFoundByTitleMarker: true,
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.FINISHED,
    hostedStatus: HOSTED_VIDEO_STATUSES.UPLOADING,
    adoptsProviderVideo: false,
  },
  {
    scenario: "adopts a video whose create response was lost",
    uploadAgeMinutes: 45,
    hasProviderVideoId: false,
    isFoundByTitleMarker: true,
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.FINISHED,
    hostedStatus: HOSTED_VIDEO_STATUSES.READY,
    adoptsProviderVideo: true,
  },
  {
    scenario: "fails an adopted video that never received its bytes",
    uploadAgeMinutes: 45,
    hasProviderVideoId: false,
    isFoundByTitleMarker: true,
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.CREATED,
    hostedStatus: HOSTED_VIDEO_STATUSES.FAILED,
    adoptsProviderVideo: true,
  },
  {
    scenario: "fails a create that never reached Bunny",
    uploadAgeMinutes: 45,
    hasProviderVideoId: false,
    isFoundByTitleMarker: false,
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.FINISHED,
    hostedStatus: HOSTED_VIDEO_STATUSES.FAILED,
    adoptsProviderVideo: false,
  },
  {
    scenario: "keeps processing an upload whose worker stopped after sending the bytes",
    uploadAgeMinutes: 45,
    hasProviderVideoId: true,
    isFoundByTitleMarker: false,
    bunnyApiStatus: BUNNY_API_VIDEO_STATUSES.UPLOADED,
    hostedStatus: HOSTED_VIDEO_STATUSES.PROCESSING,
    adoptsProviderVideo: false,
  },
];

export const WEBHOOK_REJECTION_CASES = [
  {
    scenario: "rejects a webhook with an invalid signature",
    isSignatureValid: false,
    isVideoKnown: true,
    httpStatus: 400,
  },
  {
    scenario: "ignores a webhook for a video it did not create",
    isSignatureValid: true,
    isVideoKnown: false,
    httpStatus: 201,
  },
];

export const BUNNY_WEBHOOK_SIGNATURE_HEADERS = {
  "x-bunnystream-signature": "a".repeat(64),
  "x-bunnystream-signature-version": "v1",
  "x-bunnystream-signature-algorithm": "hmac-sha256",
};
