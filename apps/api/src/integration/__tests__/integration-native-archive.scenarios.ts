import { KEY_KINDS } from "./integration-courses.scenarios";

import type { KeyKind } from "./integration-courses.scenarios";

export const EXPORT_ACCESS_CASES: Array<{ keyKind: KeyKind; status: number }> = [
  { keyKind: KEY_KINDS.MANAGING, status: 201 },
  { keyKind: KEY_KINDS.NOT_MANAGING, status: 403 },
];

export const JOB_ENDPOINTS = {
  STATUS: "status",
  DOWNLOAD: "download",
} as const;

export type JobEndpoint = (typeof JOB_ENDPOINTS)[keyof typeof JOB_ENDPOINTS];

export const FOREIGN_TENANT_JOB_CASES: Array<{ endpoint: JobEndpoint }> = [
  { endpoint: JOB_ENDPOINTS.STATUS },
  { endpoint: JOB_ENDPOINTS.DOWNLOAD },
];

export const ARCHIVED_COURSE = {
  title: "Marketplace Algebra",
  description: "Course published to the content marketplace",
  thumbnailS3Key: null,
} as const;

export const UNKNOWN_JOB_ID = "999999999";
