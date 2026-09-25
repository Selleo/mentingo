import { createHash, randomBytes } from "node:crypto";
import { basename } from "node:path";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  FEATURES,
  FEATURE_SETTINGS_KEYS,
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  ALLOWED_AVATAR_IMAGE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  DEFAULT_TUS_TTL_MS,
  DEFAULT_TUS_CHUNK_SIZE,
  ENTITY_TYPES,
  MAX_COURSE_TRAILER_VIDEO_SIZE,
  PERMISSIONS,
  RESOURCE_VISIBILITY,
  SCORM_IMPORT_ACTION,
  SUPPORTED_LANGUAGES,
  VIDEO_PROVIDERS,
  hasAnyPermission,
} from "@repo/shared";

import { ArticlesService } from "src/articles/services/articles.service";
import { CourseService } from "src/courses/course.service";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_PRESENTATION_FILE_SIZE,
  MAX_VIDEO_SIZE,
  RESOURCE_RELATIONSHIP_TYPES,
} from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LearningPathService } from "src/learning-path/services/learning-path.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { NewsService } from "src/news/news.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { REDIS_CLIENT, RedisClient } from "src/redis";
import { MAX_SCORM_THUMBNAIL_SIZE } from "src/scorm/pipes/validate-scorm-course-files.pipe";
import {
  MAX_SCORM_PACKAGE_SIZE_BYTES,
  SCORM_PACKAGE_MIME_TYPES,
} from "src/scorm/scorm-package-limits";
import { SCORM_TUS_STATE_TTL } from "src/scorm/scorm-tus-upload.constants";
import { ScormTusUploadService } from "src/scorm/scorm-tus-upload.service";
import { ScormService } from "src/scorm/scorm.service";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { McpResourceService } from "./mcp-resource.service";
import { McpTokenService } from "./mcp-token.service";

import type {
  McpAvatarUploadGrant,
  McpCourseUploadGrant,
  McpEditorialCoverUploadGrant,
  McpEditorialUploadGrant,
  McpGenericFileUploadGrant,
  McpLearningPathUploadGrant,
  McpLessonUploadGrant,
  McpScormTusGrant,
  McpScormUploadGrant,
  McpUploadGrant,
  McpVideoTusGrant,
} from "./mcp.types";
import type { Request } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { InitScormImportBody } from "src/scorm/schemas/scormImport.schema";

const GRANT_TTL_SECONDS = 5 * 60;
export const MCP_UPLOAD_TOKEN_PREFIX = "mcpup_";
const LESSON_UPLOAD_ROUTE = "/api/lesson/upload-files-to-lesson";
const GENERIC_FILE_UPLOAD_ROUTE = "/api/file";

const createUploadToken = () =>
  `${MCP_UPLOAD_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;

function isTusGrant(grant: McpUploadGrant): grant is McpVideoTusGrant | McpScormTusGrant {
  return "kind" in grant && (grant.kind === "videoTus" || grant.kind === "scormTus");
}

function genericFileAuthoringPermissions(resource: McpGenericFileUploadGrant["resource"]) {
  return resource === ENTITY_TYPES.COURSE
    ? [PERMISSIONS.COURSE_CREATE, PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN]
    : [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN];
}

@Injectable()
export class McpUploadGrantService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly tokenService: McpTokenService,
    private readonly resourceService: McpResourceService,
    private readonly permissionsService: PermissionsService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly lessonService: AdminLessonService,
    private readonly fileService: FileService,
    private readonly courseService: CourseService,
    private readonly scormService: ScormService,
    private readonly scormTusUploadService: ScormTusUploadService,
    private readonly learningPathService: LearningPathService,
    private readonly articlesService: ArticlesService,
    private readonly newsService: NewsService,
    private readonly settingsService: SettingsService,
  ) {}

  async issueLessonGrant(
    actor: CurrentUserType,
    input: Pick<McpLessonUploadGrant, "lessonId" | "language" | "filename" | "mimeType" | "size">,
  ) {
    this.validateUploadFile(input, MAX_VIDEO_SIZE);

    await this.lessonService.validateAccess(ENTITY_TYPES.LESSON, actor, input.lessonId);

    const token = createUploadToken();
    const grant: McpLessonUploadGrant = {
      ...input,
      targetType: ENTITY_TYPES.LESSON,
      targetId: input.lessonId,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });

    return {
      uploadPath: LESSON_UPLOAD_ROUTE,
      method: "POST" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: "file",
      fields: {
        lessonId: grant.lessonId,
        language: grant.language,
        title: grant.filename,
        description: "",
      },
    };
  }

  async issueEditorialGrant(
    actor: CurrentUserType,
    input: Pick<
      McpEditorialUploadGrant,
      "targetType" | "targetId" | "language" | "filename" | "mimeType" | "size"
    >,
  ) {
    this.validateUploadFile(input, MAX_FILE_SIZE);
    await this.validateEditorialAccess(actor, input);

    const token = createUploadToken();
    const grant: McpEditorialUploadGrant = {
      ...input,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath: `/api/${grant.targetType}/${grant.targetId}/upload`,
      method: "POST" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: "file",
      fields: { language: grant.language, title: grant.filename, description: "" },
    };
  }

  async issueCourseGrant(
    actor: CurrentUserType,
    input: Pick<
      McpCourseUploadGrant,
      "targetId" | "kind" | "language" | "filename" | "mimeType" | "size" | "thumbnailPositionY"
    >,
  ) {
    const allowedTypes: readonly string[] =
      input.kind === "thumbnail"
        ? ALLOWED_LESSON_IMAGE_FILE_TYPES
        : ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES;
    if (
      !allowedTypes.includes(input.mimeType) ||
      input.size < 1 ||
      input.size > MAX_FILE_SIZE ||
      !input.filename ||
      input.filename.length > 255 ||
      basename(input.filename) !== input.filename ||
      (input.kind === "thumbnail" &&
        (input.thumbnailPositionY === undefined ||
          !Number.isInteger(input.thumbnailPositionY) ||
          input.thumbnailPositionY < 0 ||
          input.thumbnailPositionY > 100)) ||
      (input.kind === "certificateSignature" && input.thumbnailPositionY !== undefined)
    )
      throw new BadRequestException("Unsupported course upload");

    await this.courseService.getBetaCourseById(input.targetId, input.language, actor);
    const token = createUploadToken();
    const grant: McpCourseUploadGrant = {
      ...input,
      targetType: ENTITY_TYPES.COURSE,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath:
        input.kind === "thumbnail"
          ? `/api/course/${input.targetId}/media`
          : `/api/course/settings/${input.targetId}`,
      method: "PATCH" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: input.kind === "thumbnail" ? "image" : "certificateSignature",
      fields:
        input.kind === "thumbnail"
          ? { language: input.language, thumbnailPositionY: String(input.thumbnailPositionY) }
          : {},
    };
  }

  async issueLearningPathGrant(
    actor: CurrentUserType,
    input: Pick<McpLearningPathUploadGrant, "targetId" | "kind" | "filename" | "mimeType" | "size">,
  ) {
    const allowed =
      input.kind === "thumbnail"
        ? ALLOWED_LESSON_IMAGE_FILE_TYPES
        : ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES;
    this.validateNamedFile(input, allowed, MAX_FILE_SIZE);
    await this.validateLearningPathAccess(actor, input.targetId);

    const token = createUploadToken();
    const grant: McpLearningPathUploadGrant = {
      ...input,
      targetType: ENTITY_TYPES.LEARNING_PATH,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath: `/api/learning-path/${input.targetId}`,
      method: "PATCH" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: input.kind,
      fields: {},
    };
  }

  async issueEditorialCoverGrant(
    actor: CurrentUserType,
    input: Pick<
      McpEditorialCoverUploadGrant,
      "targetType" | "targetId" | "language" | "filename" | "mimeType" | "size" | "translations"
    >,
  ) {
    this.validateNamedFile(input, ALLOWED_LESSON_IMAGE_FILE_TYPES, MAX_FILE_SIZE);
    if (!input.translations.some((item) => item.language === input.language))
      throw new BadRequestException("Cover language is missing from translations");
    await this.validateEditorialAccess(actor, input);

    const token = createUploadToken();
    const grant: McpEditorialCoverUploadGrant = {
      ...input,
      kind: "cover",
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath: `/api/${input.targetType}/${input.targetId}`,
      method: "PATCH" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: `cover.${input.language}`,
      fields: { translations: JSON.stringify(input.translations) },
    };
  }

  async issueAvatarGrant(
    actor: CurrentUserType,
    input: Pick<McpAvatarUploadGrant, "targetId" | "filename" | "mimeType" | "size">,
  ) {
    this.validateNamedFile(input, ALLOWED_AVATAR_IMAGE_TYPES, MAX_FILE_SIZE);
    await this.lessonService.validateAccess(ENTITY_TYPES.LESSON, actor, input.targetId);

    const token = createUploadToken();
    const grant: McpAvatarUploadGrant = {
      ...input,
      kind: "aiMentorAvatar",
      targetType: ENTITY_TYPES.LESSON,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath: "/api/lesson/ai-mentor/avatar",
      method: "POST" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: "file",
      fields: { lessonId: input.targetId },
    };
  }

  async issueGenericFileGrant(
    actor: CurrentUserType,
    input: Pick<McpGenericFileUploadGrant, "resource" | "filename" | "mimeType" | "size">,
  ) {
    const allowedTypes: readonly string[] = ALLOWED_MIME_TYPES.filter(
      (type) => !type.startsWith("video/"),
    );
    this.validateNamedFile(input, allowedTypes, MAX_FILE_SIZE);
    if (
      ALLOWED_PRESENTATION_FILE_TYPES.includes(input.mimeType) &&
      input.size > MAX_PRESENTATION_FILE_SIZE
    )
      throw new BadRequestException("Presentation file is too large");
    if (
      !actor.permissions.includes(PERMISSIONS.FILE_UPLOAD) ||
      !hasAnyPermission(actor.permissions, genericFileAuthoringPermissions(input.resource))
    )
      throw new ForbiddenException("Missing authoring upload permission");

    const token = createUploadToken();
    const grant: McpGenericFileUploadGrant = {
      ...input,
      kind: "genericFile",
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    return {
      uploadPath: GENERIC_FILE_UPLOAD_ROUTE,
      method: "POST" as const,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: "file",
      fields: { resource: grant.resource },
    };
  }

  async issueScormGrant(
    actor: CurrentUserType,
    input: Omit<McpScormUploadGrant, "userId" | "tenantId" | "expiresAt">,
  ) {
    await this.validateScormInput(actor, input);

    const token = createUploadToken();
    const grant: McpScormUploadGrant = {
      ...input,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + GRANT_TTL_SECONDS * 1000,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), { EX: GRANT_TTL_SECONDS });
    let uploadPath: string;
    let fields: Record<string, string | undefined>;
    let method: "POST" | "PATCH" = "POST";
    if (input.operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      uploadPath = "/api/scorm/course";
      fields = {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        language: input.language,
      };
    } else if (input.operation === SCORM_IMPORT_ACTION.CREATE_LESSON) {
      uploadPath = "/api/scorm/lesson";
      fields = { chapterId: input.targetId, title: input.title, language: input.language };
    } else {
      uploadPath = `/api/scorm/lesson/${input.targetId}/package`;
      fields = { title: input.title, language: input.language };
      method = "PATCH";
    }
    return {
      uploadPath,
      method,
      authorizationScheme: "Bearer" as const,
      token,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      fileField: "scormPackage",
      ...(grant.thumbnailFilename ? { additionalFileField: "thumbnail" } : {}),
      fields,
    };
  }

  private async validateScormInput(
    actor: CurrentUserType,
    input: Omit<McpScormUploadGrant, "userId" | "tenantId" | "expiresAt">,
  ) {
    if (
      (input.operation === SCORM_IMPORT_ACTION.CREATE_COURSE &&
        (input.targetType !== ENTITY_TYPES.COURSE ||
          input.categoryId !== input.targetId ||
          input.description === undefined)) ||
      (input.operation === SCORM_IMPORT_ACTION.CREATE_LESSON &&
        input.targetType !== ENTITY_TYPES.CHAPTER) ||
      (input.operation === SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE &&
        input.targetType !== ENTITY_TYPES.LESSON)
    )
      throw new BadRequestException("Invalid SCORM upload target");
    if (
      !Object.values(SCORM_PACKAGE_MIME_TYPES).includes(
        input.mimeType as (typeof SCORM_PACKAGE_MIME_TYPES)[keyof typeof SCORM_PACKAGE_MIME_TYPES],
      ) ||
      input.size < 1 ||
      input.size > MAX_SCORM_PACKAGE_SIZE_BYTES ||
      basename(input.filename) !== input.filename ||
      !input.filename.toLowerCase().endsWith(".zip")
    )
      throw new BadRequestException("Unsupported SCORM package");
    if (
      input.thumbnailFilename !== undefined ||
      input.thumbnailMimeType !== undefined ||
      input.thumbnailSize !== undefined
    ) {
      if (
        input.operation !== SCORM_IMPORT_ACTION.CREATE_COURSE ||
        input.thumbnailFilename === undefined ||
        input.thumbnailMimeType === undefined ||
        input.thumbnailSize === undefined
      )
        throw new BadRequestException("Invalid SCORM thumbnail");
      this.validateNamedFile(
        {
          filename: input.thumbnailFilename,
          mimeType: input.thumbnailMimeType,
          size: input.thumbnailSize,
        },
        ALLOWED_LESSON_IMAGE_FILE_TYPES,
        MAX_SCORM_THUMBNAIL_SIZE,
      );
    }

    if (input.operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      if (!actor.permissions.includes(PERMISSIONS.COURSE_CREATE))
        throw new ForbiddenException("Missing course creation permission");
    } else {
      await this.lessonService.validateAccess(input.targetType, actor, input.targetId);
    }
  }

  async issueScormTusGrant(
    actor: CurrentUserType,
    input: Omit<McpScormUploadGrant, "userId" | "tenantId" | "expiresAt">,
  ) {
    if (input.thumbnailFilename)
      throw new BadRequestException("Use multipart transport for a SCORM thumbnail");
    await this.validateScormInput(actor, input);
    let importRequest: InitScormImportBody;
    if (input.operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      importRequest = {
        action: input.operation,
        filename: input.filename,
        sizeBytes: input.size,
        mimeType: input.mimeType,
        metadata: {
          title: input.title,
          description: input.description!,
          categoryId: input.categoryId!,
          language: input.language,
        },
      };
    } else if (input.operation === SCORM_IMPORT_ACTION.CREATE_LESSON) {
      importRequest = {
        action: input.operation,
        filename: input.filename,
        sizeBytes: input.size,
        mimeType: input.mimeType,
        metadata: { chapterId: input.targetId, title: input.title, language: input.language },
      };
    } else {
      importRequest = {
        action: input.operation,
        lessonId: input.targetId,
        filename: input.filename,
        sizeBytes: input.size,
        mimeType: input.mimeType,
        metadata: { title: input.title, language: input.language },
      };
    }

    const upload = await this.scormService.initTusImport({ importRequest, currentUser: actor });
    await this.scormTusUploadService.createSession({
      ...upload,
      importRequest,
      currentUser: actor,
    });
    const token = createUploadToken();
    const grant: McpScormTusGrant = {
      kind: "scormTus",
      operation: input.operation,
      targetType: input.targetType,
      targetId: input.targetId,
      packageId: upload.packageId,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + SCORM_TUS_STATE_TTL,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), {
      EX: Math.ceil(SCORM_TUS_STATE_TTL / 1000),
    });
    return {
      packageId: upload.packageId,
      uploadId: upload.uploadId,
      tusEndpoint: "/api/scorm/import/tus",
      tusHeaders: { Authorization: `Bearer ${token}` },
      partSize: DEFAULT_TUS_CHUNK_SIZE,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      completePath: `/api/scorm/import/${upload.packageId}/complete`,
      completeMethod: "POST" as const,
      metadata: { uploadId: upload.packageId, filename: input.filename, filetype: input.mimeType },
    };
  }

  async issueVideoTusGrant(
    actor: CurrentUserType,
    input: Pick<
      McpVideoTusGrant,
      "targetType" | "targetId" | "language" | "filename" | "mimeType" | "size"
    >,
  ) {
    const maxSize =
      input.targetType === ENTITY_TYPES.COURSE ? MAX_COURSE_TRAILER_VIDEO_SIZE : MAX_VIDEO_SIZE;
    this.validateNamedFile(input, ALLOWED_VIDEO_FILE_TYPES, maxSize);
    await this.validateAuthoringTargetAccess(actor, input);

    const upload = await this.fileService.initVideoUpload(
      {
        filename: input.filename,
        sizeBytes: input.size,
        mimeType: input.mimeType,
        title: input.filename,
        resource: input.targetType,
        entityId: input.targetId,
        entityType: input.targetType,
        relationshipType:
          input.targetType === ENTITY_TYPES.COURSE
            ? RESOURCE_RELATIONSHIP_TYPES.TRAILER
            : RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        linkToEntity: true,
        visibility: RESOURCE_VISIBILITY.PUBLIC,
      },
      actor,
    );

    if (upload.provider !== VIDEO_PROVIDERS.S3) return upload;
    const token = createUploadToken();
    const grant: McpVideoTusGrant = {
      ...input,
      kind: "videoTus",
      uploadId: upload.uploadId,
      userId: actor.userId,
      tenantId: actor.tenantId,
      expiresAt: Date.now() + DEFAULT_TUS_TTL_MS,
    };
    await this.redis.set(this.key(token), JSON.stringify(grant), {
      EX: Math.ceil(DEFAULT_TUS_TTL_MS / 1000),
    });
    return {
      ...upload,
      tusHeaders: { ...upload.tusHeaders, Authorization: `Bearer ${token}` },
      metadata: { uploadId: upload.uploadId, filename: input.filename, filetype: input.mimeType },
    };
  }

  async authenticate(request: Request): Promise<{
    user: CurrentUserType;
    grant: McpUploadGrant;
  }> {
    const authorization = request.headers.authorization;
    if (!["POST", "PATCH", "HEAD", "GET"].includes(request.method) || !authorization) {
      throw new UnauthorizedException("Invalid upload grant");
    }

    let token: string;
    if (authorization.startsWith(`Bearer ${MCP_UPLOAD_TOKEN_PREFIX}`)) {
      token = authorization.slice("Bearer ".length);
    } else if (authorization.startsWith("Upload ")) {
      token = authorization.slice("Upload ".length);
    } else {
      throw new UnauthorizedException("Invalid upload grant");
    }
    if (!token || token.length > 256) throw new UnauthorizedException("Invalid upload grant");

    const grantKey = this.key(token);
    const storedGrant = await this.redis.get(grantKey);
    if (!storedGrant) throw new UnauthorizedException("Upload grant expired or already used");
    let stored: McpUploadGrant;
    try {
      stored = JSON.parse(storedGrant) as McpUploadGrant;
    } catch {
      throw new UnauthorizedException("Invalid upload grant");
    }
    const rawGrant = isTusGrant(stored)
      ? storedGrant
      : await this.redis.sendCommand(["GETDEL", grantKey]);
    if (!rawGrant || typeof rawGrant !== "string") {
      throw new UnauthorizedException("Upload grant expired or already used");
    }

    let grant: McpUploadGrant;
    try {
      grant = JSON.parse(rawGrant) as McpUploadGrant;
    } catch {
      throw new UnauthorizedException("Invalid upload grant");
    }
    if (grant.expiresAt <= Date.now()) throw new UnauthorizedException("Upload grant expired");
    let allowedRoute = false;
    if (isTusGrant(grant)) {
      if (grant.kind === "videoTus") {
        allowedRoute =
          (request.method === "POST" && request.path === "/api/file/videos/tus") ||
          (["HEAD", "PATCH"].includes(request.method) &&
            request.path === `/api/file/videos/tus/${grant.uploadId}`) ||
          (request.method === "GET" && request.path === `/api/file/videos/${grant.uploadId}`);
      } else {
        allowedRoute =
          (request.method === "POST" && request.path === "/api/scorm/import/tus") ||
          (["HEAD", "PATCH"].includes(request.method) &&
            request.path === `/api/scorm/import/tus/${grant.packageId}`) ||
          (request.method === "POST" &&
            request.path === `/api/scorm/import/${grant.packageId}/complete`);
      }
    } else {
      let expectedPath: string;
      let expectedMethod: "POST" | "PATCH" = "POST";
      if ("operation" in grant) {
        if (grant.operation === SCORM_IMPORT_ACTION.CREATE_COURSE)
          expectedPath = "/api/scorm/course";
        else if (grant.operation === SCORM_IMPORT_ACTION.CREATE_LESSON)
          expectedPath = "/api/scorm/lesson";
        else {
          expectedPath = `/api/scorm/lesson/${grant.targetId}/package`;
          expectedMethod = "PATCH";
        }
      } else if ("kind" in grant && grant.kind === "genericFile") {
        expectedPath = GENERIC_FILE_UPLOAD_ROUTE;
      } else if ("kind" in grant && grant.kind === "cover") {
        expectedPath = `/api/${grant.targetType}/${grant.targetId}`;
        expectedMethod = "PATCH";
      } else if (grant.targetType === ENTITY_TYPES.LEARNING_PATH) {
        expectedPath = `/api/learning-path/${grant.targetId}`;
        expectedMethod = "PATCH";
      } else if ("kind" in grant && grant.kind === "aiMentorAvatar") {
        expectedPath = "/api/lesson/ai-mentor/avatar";
      } else if (grant.targetType === ENTITY_TYPES.COURSE) {
        expectedPath =
          grant.kind === "thumbnail"
            ? `/api/course/${grant.targetId}/media`
            : `/api/course/settings/${grant.targetId}`;
        expectedMethod = "PATCH";
      } else if (grant.targetType === ENTITY_TYPES.LESSON) expectedPath = LESSON_UPLOAD_ROUTE;
      else expectedPath = `/api/${grant.targetType}/${grant.targetId}/upload`;
      allowedRoute = request.path === expectedPath && request.method === expectedMethod;
    }
    if (!allowedRoute) throw new UnauthorizedException("Upload grant is for another target");
    const resource = await this.resourceService.fromRequest(request);
    if (resource.tenantId !== grant.tenantId)
      throw new UnauthorizedException("Upload grant is for another tenant host");

    const email = await this.tokenService.resolveIdentity(grant.userId, grant.tenantId);
    if (!email) throw new UnauthorizedException("Upload user is no longer active");

    const access = await this.tenantDbRunnerService.runWithTenantContext(grant.tenantId, () =>
      this.permissionsService.getUserAccess(grant.userId),
    );
    let requiredPermissions;
    if ("kind" in grant && grant.kind === "genericFile") {
      requiredPermissions = [PERMISSIONS.FILE_UPLOAD];
      if (!hasAnyPermission(access.permissions, genericFileAuthoringPermissions(grant.resource)))
        throw new ForbiddenException("Authoring permission was revoked");
    } else if ("operation" in grant && grant.operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
      requiredPermissions = [PERMISSIONS.COURSE_CREATE];
    } else if (grant.targetType === ENTITY_TYPES.LEARNING_PATH) {
      requiredPermissions = [
        PERMISSIONS.LEARNING_PATH_UPDATE,
        PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
      ];
    } else if (
      "operation" in grant ||
      grant.targetType === ENTITY_TYPES.LESSON ||
      grant.targetType === ENTITY_TYPES.COURSE
    ) {
      requiredPermissions = [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN];
    } else if (grant.targetType === ENTITY_TYPES.ARTICLES) {
      requiredPermissions = [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN];
    } else {
      requiredPermissions = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN];
    }
    if (!hasAnyPermission(access.permissions, requiredPermissions))
      throw new ForbiddenException("Authoring permission was revoked");

    const user: CurrentUserType = {
      userId: grant.userId,
      tenantId: grant.tenantId,
      email,
      roleSlugs: access.roleSlugs,
      permissions: access.permissions,
    };
    await this.tenantDbRunnerService.runWithTenantContext(grant.tenantId, async () => {
      if ("kind" in grant && grant.kind === "genericFile") return;
      if (isTusGrant(grant) && grant.kind === "videoTus") {
        await this.validateAuthoringTargetAccess(user, grant);
        return;
      }
      if ("operation" in grant && grant.operation === SCORM_IMPORT_ACTION.CREATE_COURSE) {
        return;
      }
      if ("operation" in grant) {
        await this.lessonService.validateAccess(grant.targetType, user, grant.targetId);
      } else if (grant.targetType === ENTITY_TYPES.LEARNING_PATH) {
        await this.validateLearningPathAccess(user, grant.targetId);
      } else if (grant.targetType === ENTITY_TYPES.COURSE) {
        await this.courseService.getBetaCourseById(grant.targetId, grant.language, user);
      } else if (grant.targetType === ENTITY_TYPES.LESSON) {
        await this.lessonService.validateAccess(ENTITY_TYPES.LESSON, user, grant.targetId);
      } else if (
        grant.targetType === ENTITY_TYPES.ARTICLES ||
        grant.targetType === ENTITY_TYPES.NEWS
      ) {
        await this.validateEditorialAccess(user, {
          targetType: grant.targetType,
          targetId: grant.targetId,
          language: grant.language,
        });
      }
    });
    return { user, grant };
  }

  private validateUploadFile(
    input: Pick<McpEditorialUploadGrant, "language" | "filename" | "mimeType" | "size">,
    maxSize: number,
  ) {
    const supportedTypes = [
      ...ALLOWED_PDF_FILE_TYPES,
      ...ALLOWED_EXCEL_FILE_TYPES,
      ...ALLOWED_WORD_FILE_TYPES,
      ...ALLOWED_VIDEO_FILE_TYPES,
      ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
      ...ALLOWED_PRESENTATION_FILE_TYPES,
    ];
    if (
      !Object.values(SUPPORTED_LANGUAGES).includes(input.language) ||
      !supportedTypes.includes(input.mimeType) ||
      input.size < 1 ||
      input.size > maxSize ||
      !input.filename ||
      input.filename.length > 255 ||
      basename(input.filename) !== input.filename
    ) {
      throw new BadRequestException("Unsupported upload file");
    }
  }

  private validateNamedFile(
    input: { filename: string; mimeType: string; size: number },
    allowedTypes: readonly string[],
    maxSize: number,
  ) {
    if (
      !allowedTypes.includes(input.mimeType) ||
      input.size < 1 ||
      input.size > maxSize ||
      !input.filename ||
      input.filename.length > 255 ||
      basename(input.filename) !== input.filename
    )
      throw new BadRequestException("Unsupported upload file");
  }

  private async validateLearningPathAccess(actor: CurrentUserType, pathId: string): Promise<void> {
    const settings = await this.settingsService.getGlobalSettings();
    if (!settings.learningPathsEnabled)
      throw new ForbiddenException("Development paths are unavailable");
    const path = await this.learningPathService.getLearningPathById(pathId, actor);
    if (
      !actor.permissions.includes(PERMISSIONS.LEARNING_PATH_UPDATE) &&
      path.authorId !== actor.userId
    )
      throw new ForbiddenException("Development path is not manageable");
  }

  private async validateAuthoringTargetAccess(
    actor: CurrentUserType,
    input: Pick<McpVideoTusGrant, "targetType" | "targetId" | "language">,
  ): Promise<void> {
    if (input.targetType === ENTITY_TYPES.COURSE) {
      await this.courseService.getBetaCourseById(input.targetId, input.language, actor);
    } else if (input.targetType === ENTITY_TYPES.LESSON) {
      await this.lessonService.validateAccess(ENTITY_TYPES.LESSON, actor, input.targetId);
    } else {
      await this.validateEditorialAccess(actor, {
        targetType: input.targetType,
        targetId: input.targetId,
        language: input.language,
      });
    }
  }

  private async validateEditorialAccess(
    actor: CurrentUserType,
    input: Pick<McpEditorialUploadGrant, "targetType" | "targetId" | "language">,
  ): Promise<void> {
    const settings = await this.settingsService.getGlobalSettings();
    const feature = input.targetType === ENTITY_TYPES.ARTICLES ? FEATURES.ARTICLES : FEATURES.NEWS;
    if (!settings[FEATURE_SETTINGS_KEYS[feature]])
      throw new ForbiddenException("Feature is unavailable");
    if (input.targetType === ENTITY_TYPES.ARTICLES) {
      await this.articlesService.getArticle(input.targetId, input.language, true, actor);
      return;
    }
    const news = await this.newsService.getNews(input.targetId, input.language, actor);
    if (!actor.permissions.includes(PERMISSIONS.NEWS_MANAGE) && news.authorId !== actor.userId) {
      throw new ForbiddenException("News post is not manageable");
    }
  }

  private key(token: string): string {
    const digest = createHash("sha256").update(token).digest("hex");
    return `mcp:upload:${digest}`;
  }
}
