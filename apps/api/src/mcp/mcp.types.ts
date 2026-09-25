import type { ENTITY_TYPES, SCORM_IMPORT_ACTION, SupportedLanguages } from "@repo/shared";
import type { Request } from "express";
import type { UUIDType } from "src/common";

export type McpUploadTargetType =
  | typeof ENTITY_TYPES.COURSE
  | typeof ENTITY_TYPES.LESSON
  | typeof ENTITY_TYPES.ARTICLES
  | typeof ENTITY_TYPES.NEWS;

export type McpRevisionEntity =
  | typeof ENTITY_TYPES.CATEGORY
  | typeof ENTITY_TYPES.COURSE
  | typeof ENTITY_TYPES.CHAPTER
  | typeof ENTITY_TYPES.LESSON
  | typeof ENTITY_TYPES.NEWS;

export type McpCallContext = {
  tool: string;
  requestId: string;
  arguments: Record<string, unknown>;
};

export type McpIdempotencyRecord = {
  fingerprint: string;
  state: "pending" | "complete";
  result?: Record<string, unknown>;
};

export type McpResource = { tenantId: UUIDType; origin: string; url: string };

export type McpAccessGrant = {
  userId: UUIDType;
  tenantId: UUIDType;
  clientId: string;
  resource: string;
  scopes: string[];
  expiresAt: number;
};

export type McpToolActor = {
  grant: McpAccessGrant;
  email: string;
};

export type McpLessonUploadGrant = {
  targetType: typeof ENTITY_TYPES.LESSON;
  targetId: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  lessonId: UUIDType;
  language: SupportedLanguages;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpEditorialUploadGrant = {
  targetType: typeof ENTITY_TYPES.ARTICLES | typeof ENTITY_TYPES.NEWS;
  targetId: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  language: SupportedLanguages;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpEditorialCoverUploadGrant = McpEditorialUploadGrant & {
  kind: "cover";
  translations: Array<{
    language: SupportedLanguages;
    title?: string;
    summary?: string;
    content?: string;
  }>;
};

export type McpCourseUploadGrant = {
  targetType: typeof ENTITY_TYPES.COURSE;
  targetId: UUIDType;
  kind: "thumbnail" | "certificateSignature";
  userId: UUIDType;
  tenantId: UUIDType;
  language: SupportedLanguages;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailPositionY?: number;
  expiresAt: number;
};

export type McpLearningPathUploadGrant = {
  targetType: typeof ENTITY_TYPES.LEARNING_PATH;
  targetId: UUIDType;
  kind: "thumbnail" | "certificateSignature";
  userId: UUIDType;
  tenantId: UUIDType;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpAvatarUploadGrant = {
  targetType: typeof ENTITY_TYPES.LESSON;
  targetId: UUIDType;
  kind: "aiMentorAvatar";
  userId: UUIDType;
  tenantId: UUIDType;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpGenericFileUploadGrant = {
  kind: "genericFile";
  resource: typeof ENTITY_TYPES.COURSE | typeof ENTITY_TYPES.LESSON;
  userId: UUIDType;
  tenantId: UUIDType;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpVideoTusGrant = {
  kind: "videoTus";
  targetType:
    | typeof ENTITY_TYPES.COURSE
    | typeof ENTITY_TYPES.LESSON
    | typeof ENTITY_TYPES.ARTICLES
    | typeof ENTITY_TYPES.NEWS;
  targetId: UUIDType;
  language: SupportedLanguages;
  uploadId: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type McpScormTusGrant = {
  kind: "scormTus";
  operation: McpScormUploadGrant["operation"];
  targetType: McpScormUploadGrant["targetType"];
  targetId: UUIDType;
  packageId: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  expiresAt: number;
};

export type McpScormUploadGrant = {
  operation:
    | typeof SCORM_IMPORT_ACTION.CREATE_COURSE
    | typeof SCORM_IMPORT_ACTION.CREATE_LESSON
    | typeof SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE;
  targetType: typeof ENTITY_TYPES.COURSE | typeof ENTITY_TYPES.CHAPTER | typeof ENTITY_TYPES.LESSON;
  targetId: UUIDType;
  userId: UUIDType;
  tenantId: UUIDType;
  language: SupportedLanguages;
  title: string;
  description?: string;
  categoryId?: UUIDType;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailFilename?: string;
  thumbnailMimeType?: string;
  thumbnailSize?: number;
  expiresAt: number;
};

export type McpUploadGrant =
  | McpLessonUploadGrant
  | McpEditorialUploadGrant
  | McpEditorialCoverUploadGrant
  | McpCourseUploadGrant
  | McpLearningPathUploadGrant
  | McpAvatarUploadGrant
  | McpGenericFileUploadGrant
  | McpVideoTusGrant
  | McpScormUploadGrant
  | McpScormTusGrant;

export type McpRequest = Request & { mcpUploadGrant?: McpUploadGrant; mcpActor?: McpToolActor };
