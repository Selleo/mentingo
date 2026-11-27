/** Internal job, claim, and realtime contracts used by the Core authoring workflow. */
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";
import type { UUIDType } from "src/common";
import type { courseAuthoringDrafts } from "src/storage/schema";

export type CourseAuthoringDraftIdentity = {
  tenantId: UUIDType;
  placeholderCourseId: UUIDType;
  sessionId: UUIDType;
  ownerId: UUIDType;
};

export type CourseAuthoringDraft = typeof courseAuthoringDrafts.$inferSelect;

export type CourseAuthoringInactiveDraftCursor = Pick<
  CourseAuthoringDraft,
  "lastActivityAt" | "id"
>;

export type CourseAuthoringSessionAccessOptions = {
  refreshDraftActivity?: boolean;
  reportDraftCompletion?: boolean;
};

export type CourseAuthoringApplicationClaim = {
  /** Placeholder identity for a pre-course export or failure receipt. */
  draftCourseId?: UUIDType;
  tenantId: UUIDType;
  courseId: UUIDType;
  sessionId: UUIDType;
  exportId: UUIDType;
  exportHash: string;
  actorId: UUIDType;
};

/** Producer-owned request fence for a system-initiated export freeze. */
export type CourseAuthoringAutonomousFence = {
  requestId: UUIDType;
  controlEpoch: number;
};

export type PreparedCourseAuthoringApplication = {
  exportId: UUIDType;
  exportHash: string;
  courseId: UUIDType;
  sessionId: UUIDType;
  operations: AuthoringOperation[];
  assetMappings: Record<string, string>;
  preparedDocumentIds: Record<string, string[]>;
  assetMimeTypes: Record<string, string>;
  audioDurations?: Record<string, number>;
  acknowledgeAssessmentChanges?: boolean;
};

export interface CourseAuthoringSubscription {
  courseId: string;
  sessionId: string;
  tenantId: string;
  cursor: number;
  members: Map<string, import("src/websocket/websocket.types").AuthenticatedSocket>;
  deltaMembers: Set<string>;
  abort: AbortController;
}

export interface CourseAuthoringApplyJob {
  draftCourseId?: UUIDType;
  acknowledgeAssessmentChanges?: boolean;
  omittedAssetIds?: UUIDType[];
  courseId: UUIDType;
  sessionId: UUIDType;
  exportId: UUIDType;
  actor: import("src/common/types/current-user.type").CurrentUserType;
}

export interface CourseAuthoringReceiptJob {
  tenantId: UUIDType;
  courseId: UUIDType;
  sessionId: UUIDType;
  exportId: UUIDType;
  exportHash: string;
}

export type AuthoringMentorPayload = Extract<
  Extract<AuthoringOperation, { chapterId: string }>["payload"],
  { lessonType: "ai_mentor" }
>;
