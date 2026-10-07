import type {
  AuthoringContextFulfillmentReceipt,
  AuthoringContextFailure,
  AuthoringContextFailureReceipt,
  AuthoringContextResponse,
} from "@japro/luma-sdk";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CourseAuthoringContextRequest = {
  schemaVersion: 1;
  contextRequestId: UUIDType;
  sessionId: UUIDType;
  requestId: UUIDType;
  taskId: UUIDType;
  taskFence: number;
  courseId: UUIDType;
  language: SupportedLanguages;
  lessonIds: UUIDType[];
  targetKinds: string[];
  requestHash: string;
};

export type CourseAuthoringContextResponse = AuthoringContextResponse;

export type CourseAuthoringContextFulfillmentReceipt = AuthoringContextFulfillmentReceipt;
export type CourseAuthoringContextFailure = AuthoringContextFailure;
export type CourseAuthoringContextFailureReceipt = AuthoringContextFailureReceipt;

export type CourseAuthoringContextBinding = {
  id: UUIDType;
  tenantId: UUIDType;
  courseId: UUIDType;
  sessionId: UUIDType;
  actorId: UUIDType;
  language: SupportedLanguages;
  cursorSequence: number;
};

export type PendingCourseAuthoringContextRequest = {
  contextRequestId: UUIDType;
  bindingId: UUIDType;
  sessionId: UUIDType;
  tenantId: UUIDType;
};
