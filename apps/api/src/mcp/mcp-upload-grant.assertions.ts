import { ForbiddenException } from "@nestjs/common";
import { ENTITY_TYPES, RESOURCE_VISIBILITY, SCORM_IMPORT_ACTION } from "@repo/shared";

import type {
  McpCourseUploadGrant,
  McpEditorialCoverUploadGrant,
  McpEditorialUploadGrant,
  McpScormTusGrant,
  McpScormUploadGrant,
  McpUploadGrant,
  McpVideoTusGrant,
} from "./mcp.types";

function isTusGrant(grant: McpUploadGrant): grant is McpVideoTusGrant | McpScormTusGrant {
  return "kind" in grant && (grant.kind === "videoTus" || grant.kind === "scormTus");
}

export function assertCourseUploadGrant(
  grant: McpUploadGrant,
  kind: McpCourseUploadGrant["kind"],
  courseId: string,
  file: Express.Multer.File | null | undefined,
  body: Record<string, unknown>,
): void {
  if (
    !file ||
    !("targetType" in grant) ||
    grant.targetType !== ENTITY_TYPES.COURSE ||
    !("kind" in grant) ||
    grant.kind !== kind ||
    grant.targetId !== courseId ||
    grant.filename !== file.originalname ||
    grant.mimeType !== file.mimetype ||
    grant.size !== file.size ||
    (kind === "thumbnail" &&
      (body.language !== grant.language ||
        Number(body.thumbnailPositionY) !== grant.thumbnailPositionY ||
        Object.keys(body).some((key) => !["language", "thumbnailPositionY"].includes(key)))) ||
    (kind === "certificateSignature" && Object.keys(body).length > 0)
  )
    throw new ForbiddenException("Course upload does not match its grant");
}

export function assertLearningPathUploadGrant(
  grant: McpUploadGrant,
  pathId: string,
  files: { thumbnail?: Express.Multer.File[]; certificateSignature?: Express.Multer.File[] },
  body: Record<string, unknown>,
): void {
  if (!("targetType" in grant) || grant.targetType !== ENTITY_TYPES.LEARNING_PATH)
    throw new ForbiddenException("Development path upload does not match its grant");
  const file = files[grant.kind]?.[0];
  if (
    grant.targetId !== pathId ||
    Object.keys(body).length > 0 ||
    !file ||
    file.originalname !== grant.filename ||
    file.mimetype !== grant.mimeType ||
    file.size !== grant.size ||
    (files.thumbnail?.length ?? 0) + (files.certificateSignature?.length ?? 0) !== 1
  )
    throw new ForbiddenException("Development path upload does not match its grant");
}

export function assertEditorialCoverUploadGrant(
  grant: McpUploadGrant,
  targetType: McpEditorialCoverUploadGrant["targetType"],
  targetId: string,
  files: Express.Multer.File[],
  body: Record<string, unknown>,
): void {
  if (
    "operation" in grant ||
    !("kind" in grant) ||
    grant.kind !== "cover" ||
    grant.targetType !== targetType ||
    grant.targetId !== targetId
  )
    throw new ForbiddenException("Cover upload does not match its grant");
  const file = files[0];
  if (
    files.length !== 1 ||
    file.fieldname !== `cover.${grant.language}` ||
    file.originalname !== grant.filename ||
    file.mimetype !== grant.mimeType ||
    file.size !== grant.size ||
    Object.keys(body).some((key) => key !== "translations") ||
    JSON.stringify(body.translations) !== JSON.stringify(grant.translations)
  )
    throw new ForbiddenException("Cover upload does not match its grant");
}

export function assertAvatarUploadGrant(
  grant: McpUploadGrant,
  lessonId: string,
  file: Express.Multer.File | null,
): void {
  if (
    !file ||
    !("targetType" in grant) ||
    grant.targetType !== ENTITY_TYPES.LESSON ||
    !("kind" in grant) ||
    grant.kind !== "aiMentorAvatar" ||
    grant.targetId !== lessonId ||
    file.originalname !== grant.filename ||
    file.mimetype !== grant.mimeType ||
    file.size !== grant.size
  )
    throw new ForbiddenException("Avatar upload does not match its grant");
}

export function assertGenericFileUploadGrant(
  grant: McpUploadGrant,
  resource: string,
  file: Express.Multer.File | undefined,
): void {
  if (
    !file ||
    !("kind" in grant) ||
    grant.kind !== "genericFile" ||
    grant.resource !== resource ||
    grant.filename !== file.originalname ||
    grant.mimeType !== file.mimetype ||
    grant.size !== file.size
  )
    throw new ForbiddenException("File upload does not match its grant");
}

export function assertVideoTusGrant(
  grant: McpUploadGrant,
  uploadId: string,
  uploadLength?: number,
  metadata?: Record<string, string>,
): void {
  if (
    !isTusGrant(grant) ||
    grant.kind !== "videoTus" ||
    grant.uploadId !== uploadId ||
    (uploadLength !== undefined && uploadLength !== grant.size) ||
    (metadata &&
      (metadata.uploadId !== grant.uploadId ||
        metadata.filename !== grant.filename ||
        metadata.filetype !== grant.mimeType))
  )
    throw new ForbiddenException("Video upload does not match its grant");
}

export function assertScormTusGrant(grant: McpUploadGrant, packageId: string): void {
  if (!isTusGrant(grant) || grant.kind !== "scormTus" || grant.packageId !== packageId)
    throw new ForbiddenException("SCORM upload does not match its grant");
}

export function assertLessonUploadGrant(
  grant: McpUploadGrant,
  file: Express.Multer.File,
  lessonId: string | undefined,
  language: string,
  title: string,
  description: string,
  contextId: string | undefined,
  visibility: string,
): void {
  if (
    "operation" in grant ||
    "kind" in grant ||
    grant.targetType !== ENTITY_TYPES.LESSON ||
    lessonId !== grant.lessonId ||
    language !== grant.language ||
    file.originalname !== grant.filename ||
    file.mimetype !== grant.mimeType ||
    file.size !== grant.size ||
    title !== grant.filename ||
    description !== "" ||
    contextId !== undefined ||
    visibility !== RESOURCE_VISIBILITY.PUBLIC
  ) {
    throw new ForbiddenException("Upload does not match its grant");
  }
}

export function assertEditorialUploadGrant(
  grant: McpUploadGrant,
  targetType: McpEditorialUploadGrant["targetType"],
  targetId: string,
  file: Express.Multer.File,
  language: string,
  title: string,
  description: string,
  visibility: string,
): void {
  if (
    "operation" in grant ||
    "kind" in grant ||
    grant.targetType !== targetType ||
    grant.targetId !== targetId ||
    grant.language !== language ||
    grant.filename !== file.originalname ||
    grant.mimeType !== file.mimetype ||
    grant.size !== file.size ||
    title !== grant.filename ||
    description !== "" ||
    visibility !== RESOURCE_VISIBILITY.PUBLIC
  ) {
    throw new ForbiddenException("Upload does not match its grant");
  }
}

export function assertScormUploadGrant(
  grant: McpUploadGrant,
  operation: McpScormUploadGrant["operation"],
  file: Express.Multer.File,
  metadata: Record<string, unknown>,
  targetId?: string,
  thumbnail?: Express.Multer.File,
): void {
  if (
    !("operation" in grant) ||
    "kind" in grant ||
    grant.operation !== operation ||
    grant.filename !== file.originalname ||
    grant.mimeType !== file.mimetype ||
    grant.size !== file.size ||
    grant.title !== metadata.title ||
    grant.language !== metadata.language
  )
    throw new ForbiddenException("SCORM upload does not match its grant");

  if (thumbnail) {
    if (
      operation !== SCORM_IMPORT_ACTION.CREATE_COURSE ||
      grant.thumbnailFilename !== thumbnail.originalname ||
      grant.thumbnailMimeType !== thumbnail.mimetype ||
      grant.thumbnailSize !== thumbnail.size
    )
      throw new ForbiddenException("SCORM thumbnail does not match its grant");
  } else if (grant.thumbnailFilename !== undefined) {
    throw new ForbiddenException("SCORM thumbnail is missing");
  }

  if (operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
    if (
      grant.targetType !== ENTITY_TYPES.COURSE ||
      grant.categoryId !== metadata.categoryId ||
      grant.description !== metadata.description ||
      metadata.status !== undefined ||
      metadata.thumbnailS3Key !== undefined ||
      metadata.priceInCents !== undefined ||
      metadata.currency !== undefined ||
      metadata.hasCertificate !== undefined
    )
      throw new ForbiddenException("SCORM course metadata does not match its grant");
    return;
  }

  if (operation === SCORM_IMPORT_ACTION.CREATE_LESSON) {
    if (grant.targetType !== ENTITY_TYPES.CHAPTER || grant.targetId !== metadata.chapterId)
      throw new ForbiddenException("SCORM chapter does not match its grant");
    return;
  }

  if (grant.targetType !== ENTITY_TYPES.LESSON || grant.targetId !== targetId)
    throw new ForbiddenException("SCORM lesson does not match its grant");
}
