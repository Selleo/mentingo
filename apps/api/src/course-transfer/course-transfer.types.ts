import type {
  COURSE_TRANSFER_ERROR_CODES,
  COURSE_TRANSFER_JOB_STATES,
  COURSE_TRANSFER_KINDS,
  COURSE_TRANSFER_MODES,
  COURSE_TRANSFER_STATUSES,
} from "./course-transfer.constants";
import type { MasterCourseExportSyncStatus } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { SourceSnapshot } from "src/course-transfer/types/course-transfer-graph.types";

export type CourseTransferKind = (typeof COURSE_TRANSFER_KINDS)[keyof typeof COURSE_TRANSFER_KINDS];

export type CourseTransferStatus =
  (typeof COURSE_TRANSFER_STATUSES)[keyof typeof COURSE_TRANSFER_STATUSES];

export type CourseTransferErrorCode =
  (typeof COURSE_TRANSFER_ERROR_CODES)[keyof typeof COURSE_TRANSFER_ERROR_CODES];

export type CourseTransferMode = (typeof COURSE_TRANSFER_MODES)[keyof typeof COURSE_TRANSFER_MODES];

export type CourseTransferJobState =
  (typeof COURSE_TRANSFER_JOB_STATES)[keyof typeof COURSE_TRANSFER_JOB_STATES];

export interface CourseTransferStreamKey {
  kind: CourseTransferKind;
  exportId: string;
  sourceTenantId: string;
  targetTenantId: string;
}

export interface CourseTransferRequest extends CourseTransferStreamKey {
  payload: Record<string, unknown>;
}

export interface CourseTransferLease extends CourseTransferStreamKey {
  streamId: string;
  operationId: string;
  revision: number;
  token: string;
}

export interface CourseTransferLeasedTransfer {
  commitDestinationWrite(
    transaction: DatabasePg,
    writeDestination: () => Promise<string>,
  ): Promise<string>;
}

export interface CourseTransferRelationship {
  kind: CourseTransferKind;
  id: UUIDType;
  sourceTenantId: UUIDType;
  sourceId: UUIDType;
  targetTenantId: UUIDType;
  targetId: UUIDType | null;
  syncStatus: MasterCourseExportSyncStatus;
  lastSyncedAt: string | null;
}

export type CourseTransferRelationshipRef = Pick<
  CourseTransferRelationship,
  "kind" | "id" | "sourceTenantId" | "sourceId" | "targetTenantId"
>;

export interface CourseTransferSyncRequest {
  kind: CourseTransferKind;
  sourceId: UUIDType;
  relationships: Omit<CourseTransferRelationshipRef, "kind">[];
  triggerEventType: string;
}

export interface CourseTransferRelationshipPair {
  kind: CourseTransferKind;
  sourceTenantId: UUIDType;
  sourceId: UUIDType;
  targetTenantId: UUIDType;
}

export interface CourseTransferExportRequest extends CourseTransferRelationshipPair {
  actorId: UUIDType;
}

export interface CourseTransferExportResult {
  targetTenantId: UUIDType;
  queued: boolean;
  reason?: string;
  exportId?: UUIDType;
}

export interface CourseTransferJob extends CourseTransferRelationshipPair {
  exportId?: UUIDType;
  operationId?: string;
  payload: Record<string, unknown>;
}

export interface CourseTransferJobStatus {
  id: string;
  name: string;
  state: CourseTransferJobState;
  attemptsMade: number;
  failedReason: string | null;
}

export type CourseTransferCourseSource =
  | { tenantId: UUIDType; courseId: UUIDType }
  | { tenantId: UUIDType; snapshot: SourceSnapshot };

export interface CourseTransferCourseDestination {
  tenantId: UUIDType;
  courseId: UUIDType;
}

export interface CourseTransferSyncPolicy {
  mode: typeof COURSE_TRANSFER_MODES.SYNC;
  exportId: UUIDType;
}

export interface CourseTransferDuplicatePolicy {
  mode: typeof COURSE_TRANSFER_MODES.DUPLICATE;
  actorId: UUIDType;
  targetCategoryId?: UUIDType;
  targetCurrency?: string;
  uploadedResourceIdsByFileKey?: ReadonlyMap<string, UUIDType>;
}

export type CourseTransferPolicy = CourseTransferSyncPolicy | CourseTransferDuplicatePolicy;

export interface CourseTransferCopyCourseInput {
  source: CourseTransferCourseSource;
  destination: CourseTransferCourseDestination;
  policy: CourseTransferDuplicatePolicy;
}

export interface CourseTransferCopyCourseResult {
  chapterMap: Map<UUIDType, UUIDType>;
  lessonMap: Map<UUIDType, UUIDType>;
}

export interface CourseTransferExportCandidatesQuery {
  kind: CourseTransferKind;
  sourceTenantId: UUIDType;
  sourceId: UUIDType;
  search?: string;
  page: number;
  perPage: number;
}

export interface CourseTransferExportCandidate {
  id: UUIDType;
  name: string;
  host: string;
  targetId: UUIDType | null;
  syncStatus: MasterCourseExportSyncStatus | null;
  lastSyncedAt: string | null;
  isExported: boolean;
}

export interface CourseTransferExportCandidatesPage {
  tenants: CourseTransferExportCandidate[];
  summary: { totalTenants: number; exportedCount: number; remainingCount: number };
  pagination: { totalItems: number; page: number; perPage: number };
}

export interface CourseTransferExportCandidatesSearch {
  search?: string;
  page?: number;
  perPage?: number;
}
