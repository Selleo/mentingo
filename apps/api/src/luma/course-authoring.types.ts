/** Internal job, claim, and realtime contracts used by the Core authoring workflow. */
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";
import type { UUIDType } from "src/common";

export type CourseAuthoringApplicationClaim = {
  tenantId: UUIDType;
  courseId: UUIDType;
  sessionId: UUIDType;
  exportId: UUIDType;
  exportHash: string;
  actorId: UUIDType;
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
  acknowledgeAssessmentChanges?: boolean;
};

export interface CourseAuthoringSubscription {
  courseId: string;
  sessionId: string;
  tenantId: string;
  cursor: number;
  members: Map<string, import("src/websocket/websocket.types").AuthenticatedSocket>;
  abort: AbortController;
}

export interface CourseAuthoringApplyJob {
  acknowledgeAssessmentChanges?: boolean;
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

export type CourseAuthoringPlacement =
  | { kind: "chapter"; targetId: UUIDType; displayOrder: number }
  | { kind: "lesson"; chapterId: UUIDType; targetId: UUIDType; displayOrder: number };
