import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer, type RegisteredTool } from "@modelcontextprotocol/server";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ACTIVITY_LOG_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_TYPES,
  ARTICLE_STATUS,
  COURSE_STATUSES,
  ENTITY_TYPES,
  FEATURES,
  FEATURE_SETTINGS_KEYS,
  LEARNING_PATH_STATUSES,
  LESSON_TYPES,
  NEWS_STATUS,
  PERMISSIONS,
  SCORM_IMPORT_ACTION,
  hasAnyPermission,
  type LessonTypes,
  type PermissionKey,
} from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { ArticlesService } from "src/articles/services/articles.service";
import { CategoryService } from "src/category/category.service";
import { AdminChapterService } from "src/chapter/adminChapter.service";
import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg } from "src/common";
import { CourseService } from "src/courses/course.service";
import { CourseTranslationService } from "src/courses/services/course-translation.service";
import { FileService } from "src/file/file.service";
import { LearningPathService } from "src/learning-path/services/learning-path.service";
import { AiJudgeConfigurationService } from "src/lesson/ai-judge-configuration/ai-judge-configuration.service";
import { AiMentorConfigurationService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-configuration.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { NewsService } from "src/news/news.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { QAService } from "src/qa/services/qa.service";
import { REDIS_CLIENT, RedisClient } from "src/redis";
import { ResourceLibraryService } from "src/resource-library/resource-library.service";
import { contentReferencesResource } from "src/resource-library/resource-library.utils";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  categories as categoryRows,
  chapters as chapterRows,
  courses as courseRows,
  groupCourses,
  groups as groupRows,
  lessons as lessonRows,
  news as newsRows,
  resources as resourceRows,
} from "src/storage/schema";

import { renderLessonResourceNode } from "./mcp-content-resource";
import { canListMcpTool } from "./mcp-tool-access";
import { asMcpInputSchema } from "./mcp-tool.schema";
import * as McpToolSchemas from "./mcp-tool.schemas";
import { McpUploadGrantService } from "./mcp-upload-grant.service";
import { withMcpUploadInstructions } from "./mcp-upload-response";

import type {
  McpCallContext,
  McpIdempotencyRecord,
  McpRevisionEntity,
  McpToolActor,
  McpUploadTargetType,
} from "./mcp.types";
import type { Request, Response } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

function uploadPermissions(targetType: McpUploadTargetType): PermissionKey[] {
  if (targetType === ENTITY_TYPES.COURSE || targetType === ENTITY_TYPES.LESSON)
    return [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN];
  if (targetType === ENTITY_TYPES.ARTICLES)
    return [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN];
  return [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN];
}

@Injectable()
export class McpHttpService {
  private readonly logger = new Logger(McpHttpService.name);
  private readonly callContext = new AsyncLocalStorage<McpCallContext>();

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly permissionsService: PermissionsService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly courseService: CourseService,
    private readonly courseTranslationService: CourseTranslationService,
    private readonly chapterService: AdminChapterService,
    private readonly chapterRepository: AdminChapterRepository,
    private readonly categoryService: CategoryService,
    private readonly lessonService: AdminLessonService,
    private readonly aiJudgeConfigurationService: AiJudgeConfigurationService,
    private readonly aiMentorConfigurationService: AiMentorConfigurationService,
    private readonly qaService: QAService,
    private readonly articlesService: ArticlesService,
    private readonly newsService: NewsService,
    private readonly learningPathService: LearningPathService,
    private readonly settingsService: SettingsService,
    private readonly uploadGrantService: McpUploadGrantService,
    private readonly fileService: FileService,
    private readonly resourceLibraryService: ResourceLibraryService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async handle(req: Request, res: Response, actor: McpToolActor): Promise<void> {
    await this.tenantDbRunnerService.runWithTenantContext(actor.grant.tenantId, async () => {
      const body = req.body as {
        method?: unknown;
        id?: unknown;
        params?: { name?: unknown; arguments?: unknown };
      };
      const args = body?.params?.arguments;
      const call: McpCallContext = {
        tool:
          body?.method === "tools/call" && typeof body?.params?.name === "string"
            ? body.params.name
            : "unknown",
        requestId:
          typeof body?.id === "string" || typeof body?.id === "number"
            ? String(body.id)
            : randomUUID(),
        arguments:
          args && typeof args === "object" && !Array.isArray(args)
            ? (args as Record<string, unknown>)
            : {},
      };
      await this.callContext.run(call, async () => {
        const access = await this.permissionsService.getUserAccess(actor.grant.userId);
        const settings = await this.settingsService.getGlobalSettings();
        const handler = createMcpHandler(() =>
          this.createServer(actor, access.permissions, settings),
        );
        await toNodeHandler(handler)(req, res, req.body);
      });
    });
  }

  private createServer(
    actor: McpToolActor,
    permissions: PermissionKey[],
    settings: Awaited<ReturnType<SettingsService["getGlobalSettings"]>>,
  ): McpServer {
    const server = new McpServer({ name: "mentingo", version: "0.1.0" });
    const registerTool = server.registerTool.bind(server);
    server.registerTool = ((name: string, config: unknown, callback: unknown) => {
      const tool = Reflect.apply(registerTool, server, [name, config, callback]) as RegisteredTool;
      if (!canListMcpTool(name, permissions, settings)) tool.disable();
      return tool;
    }) as typeof server.registerTool;

    server.registerTool(
      "get_my_capabilities",
      {
        description:
          "Show the Mentingo content management capabilities currently available to your account.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getMyCapabilitiesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async () =>
        this.run(actor, [], async (user) => {
          const settings = await this.settingsService.getGlobalSettings();
          return {
            course: {
              canCreate: user.permissions.includes(PERMISSIONS.COURSE_CREATE),
              canManage: hasAnyPermission(user.permissions, [
                PERMISSIONS.COURSE_UPDATE,
                PERMISSIONS.COURSE_UPDATE_OWN,
              ]),
              canList: user.permissions.includes(PERMISSIONS.COURSE_READ_MANAGEABLE),
              canManageGroupDeadlines: user.permissions.includes(PERMISSIONS.COURSE_ENROLLMENT),
            },
            categories: user.permissions.includes(PERMISSIONS.CATEGORY_MANAGE),
            articles:
              Boolean(settings[FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]]) &&
              hasAnyPermission(user.permissions, [
                PERMISSIONS.ARTICLE_MANAGE,
                PERMISSIONS.ARTICLE_MANAGE_OWN,
              ]),
            news:
              Boolean(settings[FEATURE_SETTINGS_KEYS[FEATURES.NEWS]]) &&
              hasAnyPermission(user.permissions, [
                PERMISSIONS.NEWS_MANAGE,
                PERMISSIONS.NEWS_MANAGE_OWN,
              ]),
            qa:
              Boolean(settings[FEATURE_SETTINGS_KEYS[FEATURES.QA]]) &&
              user.permissions.includes(PERMISSIONS.QA_MANAGE),
            developmentPaths:
              settings.learningPathsEnabled &&
              hasAnyPermission(user.permissions, [
                PERMISSIONS.LEARNING_PATH_CREATE,
                PERMISSIONS.LEARNING_PATH_UPDATE,
                PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
              ]),
          };
        }),
    );

    server.registerTool(
      "list_courses",
      {
        description:
          "List manageable courses by language, optional title query and status. Pages start at 1; pageSize accepts 1–50 courses and defaults to 20. Returns compact titles, statuses, and IDs.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listCoursesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, query, status, page, pageSize }) =>
        this.run(actor, [PERMISSIONS.COURSE_READ_MANAGEABLE], async (user) => {
          const result = await this.courseService.getAllCourses({
            filters: { title: query, status },
            page: page ?? 1,
            perPage: pageSize ?? 20,
            currentUserId: user.userId,
            currentUserPermissions: user.permissions,
            language,
          });

          return {
            courses: result.data.map((course) => ({
              id: course.id,
              title: course.title,
              status: course.status,
              chapterCount: course.courseChapterCount,
            })),
            pagination: result.pagination,
          };
        }),
    );

    server.registerTool(
      "get_course",
      {
        description: "Read authoring details for one course you can edit.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getCourseInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              id: course.id,
              title: course.title,
              description: course.description,
              status: course.status,
              categoryId: course.categoryId,
              baseLanguage: course.baseLanguage,
              availableLocales: course.availableLocales,
              chapterCount: course.courseChapterCount,
              priceInCents: course.priceInCents,
              currency: course.currency,
              hasCertificate: course.hasCertificate,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "get_course_settings",
      {
        description: "Read the editable behavior settings of a course you can manage.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getCourseSettingsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              courseId,
              settings: await this.courseService.getCourseSettings(courseId),
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "list_course_group_deadlines",
      {
        description:
          "List groups assigned to a course, their mandatory setting, and their current deadline. Deadlines belong to group assignments, not the course itself. Requires course enrollment permission.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listCourseGroupDeadlinesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, language }) =>
        this.run(actor, [PERMISSIONS.COURSE_ENROLLMENT], async () => {
          const [course] = await this.db
            .select({ id: courseRows.id })
            .from(courseRows)
            .where(eq(courseRows.id, courseId))
            .limit(1);
          if (!course) throw new NotFoundException("Course not found");
          const assignments = await this.db
            .select({
              groupId: groupCourses.groupId,
              groupName: sql<string>`COALESCE(${groupRows.name}->>${language}::text, ${groupRows.name}->>${groupRows.baseLanguage}::text, '')`,
              isMandatory: groupCourses.isMandatory,
              dueDate: groupCourses.dueDate,
            })
            .from(groupCourses)
            .innerJoin(groupRows, eq(groupRows.id, groupCourses.groupId))
            .where(eq(groupCourses.courseId, courseId));
          return {
            courseId,
            groups: assignments.map((assignment) => ({
              ...assignment,
              dueDate: assignment.dueDate?.toISOString() ?? null,
            })),
          };
        }),
    );

    server.registerTool(
      "set_course_group_deadline",
      {
        description:
          "Set or clear the deadline for one group already assigned to a course. dueDate is an ISO 8601 timestamp with timezone; null clears it. Preserves the assignment's mandatory setting. Uses Mentingo's normal group enrollment flow, including calendar events.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setCourseGroupDeadlineInputSchema),
      },
      async ({ courseId, groupId, dueDate }) =>
        this.run(actor, [PERMISSIONS.COURSE_ENROLLMENT], async (user) => {
          const [assignment] = await this.db
            .select({ isMandatory: groupCourses.isMandatory })
            .from(groupCourses)
            .where(and(eq(groupCourses.courseId, courseId), eq(groupCourses.groupId, groupId)))
            .limit(1);
          if (!assignment) throw new NotFoundException("Group is not assigned to this course");
          await this.courseService.enrollGroupsToCourse(
            courseId,
            [{ id: groupId, isMandatory: assignment.isMandatory, dueDate }],
            user,
          );
          return { courseId, groupId, isMandatory: assignment.isMandatory, dueDate };
        }),
    );

    server.registerTool(
      "list_course_languages",
      {
        description: "List the base and available languages of an editable course.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listCourseLanguagesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              courseId,
              baseLanguage: course.baseLanguage,
              availableLocales: course.availableLocales,
            };
          },
        ),
    );

    server.registerTool(
      "set_course_status",
      {
        description:
          "Change course publication status after checking its current revision. Publishing requires explicit confirmation.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setCourseStatusInputSchema),
      },
      async ({ courseId, language, status, expectedRevision, confirmPublish }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseService.getBetaCourseById(courseId, language, user);
            if (status === COURSE_STATUSES.PUBLISHED && confirmPublish !== true)
              throw new ForbiddenException("Publishing requires confirmation");
            await this.withExpectedRevision(
              ENTITY_TYPES.COURSE,
              courseId,
              expectedRevision,
              async () => {
                await this.courseService.updateCourse(courseId, { language, status }, user, false);
              },
            );
            return {
              courseId,
              status,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "delete_course",
      {
        description:
          "Permanently delete an eligible course only after confirming its exact title and revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteCourseInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ courseId, language, expectedRevision, confirmTitle }) =>
        this.run(actor, [PERMISSIONS.COURSE_DELETE], async (user) => {
          const course = await this.courseService.getBetaCourseById(courseId, language, user);
          if (course.title !== confirmTitle)
            throw new ForbiddenException("Course title confirmation does not match");
          await this.withExpectedRevision(ENTITY_TYPES.COURSE, courseId, expectedRevision, () =>
            this.courseService.deleteCourse(courseId, user),
          );
          return { deletedId: courseId };
        }),
    );

    server.registerTool(
      "set_course_certificate_enabled",
      {
        description: "Enable or disable certificates for an editable course.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setCourseCertificateEnabledInputSchema),
      },
      async ({ courseId, language, enabled, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseService.getBetaCourseById(courseId, language, user);
            await this.withExpectedRevision(ENTITY_TYPES.COURSE, courseId, expectedRevision, () =>
              this.courseService.updateHasCertificate(courseId, enabled, user),
            );
            return {
              courseId,
              enabled,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "set_course_pricing",
      {
        description: "Set course price and currency using the native billing rules.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setCoursePricingInputSchema),
      },
      async ({ courseId, language, priceInCents, currency, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseService.getBetaCourseById(courseId, language, user);
            await this.withExpectedRevision(ENTITY_TYPES.COURSE, courseId, expectedRevision, () =>
              this.courseService.updateCourse(
                courseId,
                { language, priceInCents, currency: currency.toLowerCase() },
                user,
                false,
              ),
            );
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              courseId,
              priceInCents: course.priceInCents,
              currency: course.currency,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "update_course_media",
      {
        description:
          "Position the existing course thumbnail. File bytes use the existing authenticated upload API.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateCourseMediaInputSchema),
      },
      async ({ courseId, language, thumbnailPositionY, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseService.getBetaCourseById(courseId, language, user);
            await this.withExpectedRevision(ENTITY_TYPES.COURSE, courseId, expectedRevision, () =>
              this.courseService.updateCourseMedia(
                courseId,
                { language, thumbnailPositionY },
                user,
              ),
            );
            return {
              courseId,
              thumbnailPositionY,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "list_chapters",
      {
        description: "List chapters of a course you can edit, in display order.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listChaptersInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              courseId,
              chapters: await Promise.all(
                course.chapters.map(async (chapter) => ({
                  id: chapter.id,
                  title: chapter.title,
                  displayOrder: chapter.displayOrder,
                  lessonCount: chapter.lessonCount,
                  revision: await this.getRevision(ENTITY_TYPES.CHAPTER, chapter.id),
                })),
              ),
            };
          },
        ),
    );

    server.registerTool(
      "get_chapter",
      {
        description: "Read an editable chapter and its ordered lessons.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getChapterInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, chapterId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const chapter = course.chapters.find((item) => item.id === chapterId);
            if (!chapter) throw new NotFoundException("Chapter is outside this course");
            return {
              id: chapter.id,
              courseId,
              title: chapter.title,
              displayOrder: chapter.displayOrder,
              revision: await this.getRevision(ENTITY_TYPES.CHAPTER, chapterId),
              lessons: (chapter.lessons ?? []).map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
                displayOrder: lesson.displayOrder,
              })),
            };
          },
        ),
    );

    server.registerTool(
      "request_authoring_upload",
      {
        description:
          "Get a short-lived grant for one local lesson, article, or news file. The response supplies the exact uploadUrl, method, Bearer header, multipart fields and fileField. For a lesson, send bytes there, take data.resourceId from the upload HTTP response, then call insert_lesson_resource with that ID and the same lessonId; the upload alone does not place the file in lesson content.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestAuthoringUploadInputSchema),
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ targetType, targetId, language, filename, mimeType, size }) =>
        this.run(actor, uploadPermissions(targetType), (user) => {
          if (targetType === ENTITY_TYPES.LESSON) {
            return this.uploadGrantService.issueLessonGrant(user, {
              lessonId: targetId,
              language,
              filename,
              mimeType,
              size,
            });
          }
          return this.uploadGrantService.issueEditorialGrant(user, {
            targetType,
            targetId,
            language,
            filename,
            mimeType,
            size,
          });
        }),
    );

    server.registerTool(
      "request_generic_file_upload",
      {
        description:
          "Get a one-use grant to upload a course or quiz image before its entity exists. Send the local file to the returned uploadRequest.url with its Bearer header and multipart fields.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestGenericFileUploadInputSchema),
      },
      async ({ resource, filename, mimeType, size }) =>
        this.run(actor, [PERMISSIONS.FILE_UPLOAD], (user) =>
          this.uploadGrantService.issueGenericFileGrant(user, {
            resource,
            filename,
            mimeType,
            size,
          }),
        ),
    );

    server.registerTool(
      "request_course_upload",
      {
        description:
          "Get a one-use course thumbnail or certificate-signature upload grant. Use the exact uploadRequest.url, PATCH method, Bearer header, fileField and fields returned; never substitute another host.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestCourseUploadInputSchema),
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ courseId, language, kind, filename, mimeType, size, thumbnailPositionY }) =>
        this.run(actor, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN], (user) =>
          this.uploadGrantService.issueCourseGrant(user, {
            targetId: courseId,
            language,
            kind,
            filename,
            mimeType,
            size,
            thumbnailPositionY,
          }),
        ),
    );

    server.registerTool(
      "request_development_path_upload",
      {
        description:
          "Get a one-use development path thumbnail or certificate-signature grant with the exact upload URL and multipart request details.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestDevelopmentPathUploadInputSchema),
      },
      async ({ pathId, kind, filename, mimeType, size }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          (user) =>
            this.uploadGrantService.issueLearningPathGrant(user, {
              targetId: pathId,
              kind,
              filename,
              mimeType,
              size,
            }),
        ),
    );

    server.registerTool(
      "request_editorial_cover_upload",
      {
        description:
          "Get a one-use localized article or news cover grant with the exact upload URL, Bearer header and multipart request details.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestEditorialCoverUploadInputSchema),
      },
      async ({ targetType, targetId, language, filename, mimeType, size, translations }) =>
        this.run(actor, uploadPermissions(targetType), (user) =>
          this.uploadGrantService.issueEditorialCoverGrant(user, {
            targetType,
            targetId,
            language,
            filename,
            mimeType,
            size,
            translations,
          }),
        ),
    );

    server.registerTool(
      "request_ai_mentor_avatar_upload",
      {
        description:
          "Get a one-use AI Mentor avatar grant with the exact upload URL, Bearer header and multipart request details.",
        inputSchema: asMcpInputSchema(McpToolSchemas.requestAiMentorAvatarUploadInputSchema),
      },
      async ({ lessonId, filename, mimeType, size }) =>
        this.run(actor, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN], (user) =>
          this.uploadGrantService.issueAvatarGrant(user, {
            targetId: lessonId,
            filename,
            mimeType,
            size,
          }),
        ),
    );

    server.registerTool(
      "init_video_upload",
      {
        description:
          "Initialize a resumable video upload for a course trailer or authoring attachment. Upload directly to the returned uploadUrl using TUS and tusHeaders; this is not a multipart form upload.",
        inputSchema: asMcpInputSchema(McpToolSchemas.initVideoUploadInputSchema),
      },
      async ({ targetType, targetId, language, filename, mimeType, size }) =>
        this.run(actor, uploadPermissions(targetType), (user) =>
          this.uploadGrantService.issueVideoTusGrant(user, {
            targetType,
            targetId,
            language,
            filename,
            mimeType,
            size,
          }),
        ),
    );

    server.registerTool(
      "get_video_upload_status",
      {
        description: "Read the processing status of a video upload initialized by your account.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getVideoUploadStatusInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ uploadId }) =>
        this.run(actor, [], async (user) => {
          const state = await this.fileService.getVideoUploadStatus(uploadId);
          if (!state || state.userId !== user.userId || state.tenantId !== user.tenantId)
            throw new NotFoundException("Video upload not found");
          return {
            uploadId,
            status: state.status,
            resourceId: state.resourceId,
            error: state.error,
          };
        }),
    );

    server.registerTool(
      "create_scorm_course",
      {
        description:
          "Prepare a SCORM course ZIP import. The result provides an exact uploadUrl and either multipart uploadRequest instructions or TUS headers and metadata, depending on transport.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createScormCourseInputSchema),
      },
      async ({
        title,
        description,
        categoryId,
        language,
        filename,
        mimeType,
        size,
        transport,
        thumbnail,
      }) =>
        this.run(actor, [PERMISSIONS.COURSE_CREATE], async (user) => {
          await this.categoryService.getCategoryById(categoryId, language);
          const input = {
            operation: SCORM_IMPORT_ACTION.CREATE_COURSE,
            targetType: ENTITY_TYPES.COURSE as typeof ENTITY_TYPES.COURSE,
            targetId: categoryId,
            categoryId,
            title,
            description,
            language,
            filename,
            mimeType,
            size,
            ...(thumbnail
              ? {
                  thumbnailFilename: thumbnail.filename,
                  thumbnailMimeType: thumbnail.mimeType,
                  thumbnailSize: thumbnail.size,
                }
              : {}),
          };
          if (transport === "tus") return this.uploadGrantService.issueScormTusGrant(user, input);
          return this.uploadGrantService.issueScormGrant(user, input);
        }),
    );

    server.registerTool(
      "create_scorm_lesson",
      {
        description:
          "Prepare a SCORM lesson ZIP import in the course base language. Use the exact returned uploadUrl and multipart or TUS instructions.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createScormLessonInputSchema),
      },
      async ({ courseId, chapterId, title, language, filename, mimeType, size, transport }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (
              course.baseLanguage !== language ||
              !course.chapters.some((chapter) => chapter.id === chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const input = {
              operation: SCORM_IMPORT_ACTION.CREATE_LESSON,
              targetType: ENTITY_TYPES.CHAPTER as typeof ENTITY_TYPES.CHAPTER,
              targetId: chapterId,
              title,
              language,
              filename,
              mimeType,
              size,
            };
            if (transport === "tus") return this.uploadGrantService.issueScormTusGrant(user, input);
            return this.uploadGrantService.issueScormGrant(user, input);
          },
        ),
    );

    server.registerTool(
      "update_scorm_lesson",
      {
        description:
          "Prepare a SCORM ZIP upload for another language of an existing lesson. Use the exact returned uploadUrl and multipart or TUS instructions.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateScormLessonInputSchema),
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        title,
        language,
        filename,
        mimeType,
        size,
        transport,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const lesson = course.chapters
              .find((chapter) => chapter.id === chapterId)
              ?.lessons?.find((item) => item.id === lessonId);
            if (
              !lesson ||
              lesson.type !== LESSON_TYPES.SCORM ||
              !course.availableLocales.includes(language)
            )
              throw new ForbiddenException("SCORM lesson or language is outside this course");
            const input = {
              operation: SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE,
              targetType: ENTITY_TYPES.LESSON as typeof ENTITY_TYPES.LESSON,
              targetId: lessonId,
              title,
              language,
              filename,
              mimeType,
              size,
            };
            if (transport === "tus") return this.uploadGrantService.issueScormTusGrant(user, input);
            return this.uploadGrantService.issueScormGrant(user, input);
          },
        ),
    );

    server.registerTool(
      "list_course_categories",
      {
        description:
          "List valid course category IDs and names, optionally filtered by title. Pages start at 1 and contain up to 50 categories.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listCourseCategoriesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, query, page }) =>
        this.run(actor, [PERMISSIONS.COURSE_CREATE], async (user) => {
          const result = await this.categoryService.getCategories(
            { filters: { title: query }, language, page: page ?? 1, perPage: 50 },
            user.permissions,
          );
          return {
            categories: result.data.map((category) => ({ id: category.id, title: category.title })),
            pagination: result.pagination,
          };
        }),
    );

    server.registerTool(
      "list_categories",
      {
        description:
          "List categories you can manage in a selected language. Filter by title and sort by title or creation date. Pages start at 1; pageSize accepts 1–50 and defaults to 20.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listCategoriesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, query, page, pageSize, sort }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          const result = await this.categoryService.getCategories(
            { filters: { title: query }, language, page: page ?? 1, perPage: pageSize ?? 20, sort },
            user.permissions,
          );
          return {
            categories: result.data.map((category) => ({
              id: category.id,
              title: category.title,
              baseLanguage: category.baseLanguage,
              availableLocales: category.availableLocales,
            })),
            pagination: result.pagination,
          };
        }),
    );

    server.registerTool(
      "get_category",
      {
        description:
          "Read one category's localized title, base language, available translations, and current revision before editing it.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getCategoryInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ categoryId, language }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async () => {
          const category = await this.categoryService.getCategoryById(categoryId, language);
          return {
            id: category.id,
            title: category.title,
            baseLanguage: category.baseLanguage,
            availableLocales: category.availableLocales,
            language,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, categoryId),
          };
        }),
    );

    server.registerTool(
      "create_category",
      {
        description:
          "Create a course category with a title in its base language. Reuse idempotencyKey only when retrying this exact creation.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createCategoryInputSchema),
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ idempotencyKey: _idempotencyKey, ...body }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          const category = await this.categoryService.createCategory(body, user);
          return {
            id: category.id,
            title: category.title,
            baseLanguage: category.baseLanguage,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, category.id),
          };
        }),
    );

    server.registerTool(
      "update_category",
      {
        description:
          "Change a category title in an existing translation. Read get_category first and pass its current expectedRevision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateCategoryInputSchema),
        annotations: { readOnlyHint: false },
      },
      async ({ categoryId, language, title, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          const category = await this.withExpectedRevision(
            ENTITY_TYPES.CATEGORY,
            categoryId,
            expectedRevision,
            () => this.categoryService.updateCategory(categoryId, { language, title }, user),
          );
          return {
            id: category.id,
            title: category.title,
            language,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, categoryId),
          };
        }),
    );

    server.registerTool(
      "add_category_language",
      {
        description:
          "Add a supported translation language to a category; then use update_category to set its title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addCategoryLanguageInputSchema),
        annotations: { readOnlyHint: false },
      },
      async ({ categoryId, language, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          const category = await this.withExpectedRevision(
            ENTITY_TYPES.CATEGORY,
            categoryId,
            expectedRevision,
            () => this.categoryService.createLanguage(categoryId, language, user),
          );
          return {
            id: category.id,
            language,
            availableLocales: category.availableLocales,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, categoryId),
          };
        }),
    );

    server.registerTool(
      "remove_category_language",
      {
        description:
          "Remove a category translation after confirming its exact language. The base language cannot be removed.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeCategoryLanguageInputSchema),
        annotations: { destructiveHint: true },
      },
      async ({ categoryId, language, confirmLanguage, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          if (language !== confirmLanguage)
            throw new ForbiddenException("Category language confirmation does not match");
          const category = await this.withExpectedRevision(
            ENTITY_TYPES.CATEGORY,
            categoryId,
            expectedRevision,
            () => this.categoryService.deleteLanguage(categoryId, language, user),
          );
          return {
            id: category.id,
            removedLanguage: language,
            availableLocales: category.availableLocales,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, categoryId),
          };
        }),
    );

    server.registerTool(
      "set_category_base_language",
      {
        description:
          "Make an existing category translation the base language. It must already have a title and no other category may use that base title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setCategoryBaseLanguageInputSchema),
        annotations: { readOnlyHint: false },
      },
      async ({ categoryId, baseLanguage, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          const category = await this.withExpectedRevision(
            ENTITY_TYPES.CATEGORY,
            categoryId,
            expectedRevision,
            () => this.categoryService.updateBaseLanguage(categoryId, baseLanguage, user),
          );
          return {
            id: category.id,
            title: category.title,
            baseLanguage: category.baseLanguage,
            revision: await this.getRevision(ENTITY_TYPES.CATEGORY, categoryId),
          };
        }),
    );

    server.registerTool(
      "delete_category",
      {
        description:
          "Permanently delete an unused category after confirming its exact localized title and current revision. Categories assigned to courses cannot be deleted.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteCategoryInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ categoryId, language, confirmTitle, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.CATEGORY_MANAGE], async (user) => {
          await this.withExpectedRevision(
            ENTITY_TYPES.CATEGORY,
            categoryId,
            expectedRevision,
            async () => {
              const category = await this.categoryService.getCategoryById(categoryId, language);
              if (category.title !== confirmTitle)
                throw new ForbiddenException("Category title confirmation does not match");
              await this.categoryService.deleteCategory(categoryId, user);
            },
          );
          return { deletedId: categoryId };
        }),
    );

    server.registerTool(
      "create_course",
      {
        description: "Create a course with fields accepted by the native course creation API.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createCourseInputSchema),
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ idempotencyKey: _idempotencyKey, confirmPublish, ...body }) =>
        this.run(actor, [PERMISSIONS.COURSE_CREATE], async (user) => {
          if (body.status === COURSE_STATUSES.PUBLISHED && confirmPublish !== true)
            throw new ForbiddenException("Publishing requires confirmation");
          const result = await this.courseService.createCourse(body, user, false);
          return { id: result.id, status: result.status };
        }),
    );

    server.registerTool(
      "update_course",
      {
        description: "Update a course using fields accepted by the native course update API.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateCourseInputSchema),
      },
      async ({ courseId, expectedRevision, confirmPublish, ...body }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            if (Object.keys(body).every((key) => key === "language"))
              throw new ForbiddenException("No changes supplied");
            if (body.status === COURSE_STATUSES.PUBLISHED && confirmPublish !== true)
              throw new ForbiddenException("Publishing requires confirmation");
            await this.courseService.getBetaCourseById(courseId, body.language, user);
            await this.withExpectedRevision(ENTITY_TYPES.COURSE, courseId, expectedRevision, () =>
              this.courseService.updateCourse(courseId, body, user, false),
            );
            return {
              id: courseId,
              language: body.language,
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "update_course_settings",
      {
        description: "Set supported course behavior and certificate settings.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateCourseSettingsInputSchema),
      },
      async ({
        courseId,
        language,
        lessonSequenceEnabled,
        quizFeedbackEnabled,
        videoCompletionTrackingEnabled,
        certificateFontColor,
        certificateValidity,
        applyValidityToExistingCertificates,
        removeCertificateSignature,
        expectedRevision,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            if (
              [
                lessonSequenceEnabled,
                quizFeedbackEnabled,
                videoCompletionTrackingEnabled,
                certificateFontColor,
                certificateValidity,
                applyValidityToExistingCertificates,
                removeCertificateSignature,
              ].every((value) => value === undefined)
            )
              throw new ForbiddenException("No settings supplied");
            await this.courseService.getBetaCourseById(courseId, language, user);
            const settings = await this.withExpectedRevision(
              ENTITY_TYPES.COURSE,
              courseId,
              expectedRevision,
              () =>
                this.courseService.updateCourseSettings(
                  courseId,
                  {
                    lessonSequenceEnabled,
                    quizFeedbackEnabled,
                    videoCompletionTrackingEnabled,
                    certificateFontColor,
                    certificateValidity,
                    applyValidityToExistingCertificates,
                    removeCertificateSignature,
                  },
                  user,
                ),
            );
            return {
              courseId,
              settings: {
                lessonSequenceEnabled: settings.settings.lessonSequenceEnabled,
                quizFeedbackEnabled: settings.settings.quizFeedbackEnabled,
                videoCompletionTrackingEnabled: settings.settings.videoCompletionTrackingEnabled,
                certificateFontColor: settings.settings.certificateFontColor,
                certificateValidity: settings.settings.certificateValidity,
                certificateSignature: settings.settings.certificateSignature,
              },
              revision: await this.getRevision(ENTITY_TYPES.COURSE, courseId),
            };
          },
        ),
    );

    server.registerTool(
      "add_course_language",
      {
        description: "Add a supported translation language to a course you can edit.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addCourseLanguageInputSchema),
      },
      async ({ courseId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.courseTranslationService.createLanguage(courseId, language, user);
            return { courseId, addedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "remove_course_language",
      {
        description: "Remove a non-base course translation after confirming the language code.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeCourseLanguageInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ courseId, language, confirmLanguage }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            if (language !== confirmLanguage)
              throw new ForbiddenException("Language confirmation does not match");
            await this.courseService.deleteLanguage(courseId, language, user);
            return { courseId, removedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "create_chapter",
      {
        description: "Create a chapter in a course you can edit.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createChapterInputSchema),
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async ({ courseId, title }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const result = await this.chapterService.createChapterForCourse(
              { courseId, title },
              user,
            );
            return { id: result.id, courseId };
          },
        ),
    );

    server.registerTool(
      "update_chapter",
      {
        description: "Update a chapter title in an available course language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateChapterInputSchema),
      },
      async ({ courseId, chapterId, language, title, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (!course.chapters.some((chapter) => chapter.id === chapterId))
              throw new ForbiddenException("Chapter is outside this course");
            await this.withExpectedRevision(ENTITY_TYPES.CHAPTER, chapterId, expectedRevision, () =>
              this.chapterService.updateChapter(chapterId, { language, title }, user),
            );
            return {
              id: chapterId,
              courseId,
              language,
              title,
              revision: await this.getRevision(ENTITY_TYPES.CHAPTER, chapterId),
            };
          },
        ),
    );

    server.registerTool(
      "reorder_chapter",
      {
        description: "Move a chapter to a one-based display position within its course.",
        inputSchema: asMcpInputSchema(McpToolSchemas.reorderChapterInputSchema),
      },
      async ({ courseId, chapterId, language, displayOrder, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (!course.chapters.some((chapter) => chapter.id === chapterId))
              throw new NotFoundException("Chapter is outside this course");
            if (displayOrder > course.chapters.length)
              throw new ForbiddenException("Chapter position is outside this course");
            await this.withExpectedRevision(ENTITY_TYPES.CHAPTER, chapterId, expectedRevision, () =>
              this.chapterService.updateChapterDisplayOrder({
                chapterId,
                displayOrder,
                currentUser: user,
              }),
            );
            const updated = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              courseId,
              chapterIds: updated.chapters.map((chapter) => chapter.id),
              revision: await this.getRevision(ENTITY_TYPES.CHAPTER, chapterId),
            };
          },
        ),
    );

    server.registerTool(
      "delete_chapter",
      {
        description:
          "Delete a chapter and its lessons after confirming the exact title, lesson IDs, and revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteChapterInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ courseId, chapterId, language, expectedRevision, confirmTitle, confirmLessonIds }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const chapter = course.chapters.find((item) => item.id === chapterId);
            if (!chapter || chapter.title !== confirmTitle)
              throw new ForbiddenException("Chapter title confirmation does not match");
            const lessonIds = (chapter.lessons ?? []).map((lesson) => lesson.id).sort();
            if (JSON.stringify(lessonIds) !== JSON.stringify([...confirmLessonIds].sort()))
              throw new ForbiddenException("Affected lesson IDs confirmation does not match");
            await this.withExpectedRevision(ENTITY_TYPES.CHAPTER, chapterId, expectedRevision, () =>
              this.chapterService.removeChapter(chapterId, user),
            );
            return { deletedId: chapterId, affectedLessonIds: lessonIds };
          },
        ),
    );

    server.registerTool(
      "list_lessons",
      {
        description: "List lessons in one chapter, in display order, with IDs and types.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listLessonsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, chapterId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const chapter = course.chapters.find((item) => item.id === chapterId);
            if (!chapter) throw new ForbiddenException("Chapter is outside this course");
            return {
              courseId,
              chapterId,
              language,
              lessons: (chapter.lessons ?? []).map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                type: lesson.type,
                displayOrder: lesson.displayOrder,
              })),
            };
          },
        ),
    );

    server.registerTool(
      "get_lesson",
      {
        description: "Read editable lesson title, content and type by ID.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getLessonInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, chapterId, lessonId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const lesson = course.chapters
              .find((chapter) => chapter.id === chapterId)
              ?.lessons?.find((item) => item.id === lessonId);
            if (!lesson) throw new ForbiddenException("Lesson is outside this chapter");
            const details = (
              await this.chapterRepository.getBetaChapterLessons(chapterId, language)
            ).find((item) => item.id === lessonId);
            if (!details) throw new NotFoundException("Lesson not found");
            return {
              id: lesson.id,
              courseId,
              chapterId,
              language,
              title: lesson.title,
              type: lesson.type,
              description: lesson.description,
              displayOrder: lesson.displayOrder,
              thresholdScore: details.thresholdScore,
              attemptsLimit: details.attemptsLimit,
              quizCooldownInHours: details.quizCooldownInHours,
              questions: details.questions,
              aiMentor: details.aiMentor
                ? {
                    name: details.aiMentor.name,
                    voiceMode: details.aiMentor.voiceMode,
                    ttsPreset: details.aiMentor.ttsPreset,
                  }
                : null,
              lessonResources: details.lessonResources?.map((resource) => ({
                id: resource.id,
                title: resource.title,
                contentType: resource.contentType,
                fileUrl: resource.fileUrl,
              })),
              liveTrainingId: details.liveTrainingId,
              scormPackageLanguages: details.scormPackageLanguages,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "create_content_lesson",
      {
        description: "Create a content lesson in a chapter using the course base language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createContentLessonInputSchema),
      },
      async ({ courseId, chapterId, language, title, description }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (
              language !== course.baseLanguage ||
              !course.chapters.some((chapter) => chapter.id === chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const id = await this.lessonService.createLessonForChapter(
              { chapterId, title, description, type: LESSON_TYPES.CONTENT },
              user,
            );
            return { id, courseId, chapterId, language };
          },
        ),
    );

    server.registerTool(
      "update_content_lesson",
      {
        description:
          "Replace a content lesson title or complete Tiptap HTML body in an available course language. To add an uploaded file with preview or download mode while preserving the existing body, use insert_lesson_resource instead.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateContentLessonInputSchema),
      },
      async ({ courseId, chapterId, lessonId, language, title, description, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            if (title === undefined && description === undefined)
              throw new ForbiddenException("No changes supplied");
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const lesson = course.chapters
              .find((chapter) => chapter.id === chapterId)
              ?.lessons?.find((item) => item.id === lessonId);
            if (!lesson || lesson.type !== LESSON_TYPES.CONTENT)
              throw new ForbiddenException("Content lesson is outside this chapter");
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.updateLesson(lessonId, { language, title, description }, user),
            );
            return {
              id: lessonId,
              courseId,
              chapterId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "delete_content_lesson",
      {
        description: "Permanently delete a content lesson after confirming its exact title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteContentLessonInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ courseId, chapterId, lessonId, language, confirmTitle, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const lesson = course.chapters
              .find((chapter) => chapter.id === chapterId)
              ?.lessons?.find((item) => item.id === lessonId);
            if (!lesson || lesson.type !== LESSON_TYPES.CONTENT || lesson.title !== confirmTitle)
              throw new ForbiddenException("Lesson or title confirmation does not match");
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.removeLesson(lessonId, user),
            );
            return { deletedId: lessonId, courseId, chapterId };
          },
        ),
    );

    server.registerTool(
      "create_quiz_lesson",
      {
        description:
          "Create a quiz lesson with typed questions and answer options using the native quiz authoring rules.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createQuizLessonInputSchema),
      },
      async ({
        courseId,
        chapterId,
        language,
        title,
        description,
        thresholdScore,
        attemptsLimit,
        quizCooldownInHours,
        questions,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (
              course.baseLanguage !== language ||
              !course.chapters.some((chapter) => chapter.id === chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const id = await this.lessonService.createQuizLesson(
              {
                chapterId,
                title,
                description,
                type: LESSON_TYPES.QUIZ,
                thresholdScore,
                attemptsLimit,
                quizCooldownInHours,
                questions,
              },
              user,
            );
            return {
              id,
              courseId,
              chapterId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, id),
            };
          },
        ),
    );

    server.registerTool(
      "update_quiz_lesson",
      {
        description:
          "Update quiz settings and the complete typed question set after checking the lesson revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateQuizLessonInputSchema),
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        language,
        expectedRevision,
        title,
        description,
        thresholdScore,
        attemptsLimit,
        quizCooldownInHours,
        questions,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLessonType(
              courseId,
              chapterId,
              lessonId,
              language,
              LESSON_TYPES.QUIZ,
              user,
            );
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.updateQuizLesson(
                lessonId,
                {
                  language,
                  title,
                  description,
                  type: LESSON_TYPES.QUIZ,
                  thresholdScore,
                  attemptsLimit,
                  quizCooldownInHours,
                  questions,
                },
                user,
              ),
            );
            return {
              id: lessonId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "create_ai_mentor_lesson",
      {
        description:
          "Create an AI Mentor lesson using Mentingo's mentor and judge configuration validators.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createAiMentorLessonInputSchema),
      },
      async ({
        courseId,
        chapterId,
        language,
        title,
        description,
        aiMentorConfiguration,
        aiJudgeConfiguration,
        name,
        voiceMode,
        ttsPreset,
        customTtsReference,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (
              course.baseLanguage !== language ||
              !course.chapters.some((chapter) => chapter.id === chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const id = await this.lessonService.createAiMentorLesson(
              {
                chapterId,
                title,
                description,
                aiMentorConfiguration,
                aiJudgeConfiguration,
                name,
                voiceMode,
                ttsPreset,
                customTtsReference,
              },
              user,
            );
            return {
              id,
              courseId,
              chapterId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, id),
            };
          },
        ),
    );

    server.registerTool(
      "update_ai_mentor_lesson",
      {
        description:
          "Update AI Mentor lesson metadata or replace mentor/judge configuration through the native services.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateAiMentorLessonInputSchema),
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        language,
        expectedRevision,
        title,
        description,
        aiMentorConfiguration,
        aiJudgeConfiguration,
        name,
        voiceMode,
        ttsPreset,
        customTtsReference,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const currentLesson = await this.assertLessonType(
              courseId,
              chapterId,
              lessonId,
              language,
              LESSON_TYPES.AI_MENTOR,
              user,
            );
            const hasMetadata = [
              title,
              description,
              name,
              voiceMode,
              ttsPreset,
              customTtsReference,
            ].some((value) => value !== undefined);
            if (!hasMetadata && !aiMentorConfiguration && !aiJudgeConfiguration)
              throw new ForbiddenException("No changes supplied");
            await this.withExpectedRevision(
              ENTITY_TYPES.LESSON,
              lessonId,
              expectedRevision,
              async () => {
                if (hasMetadata)
                  await this.lessonService.updateAiMentorLesson(
                    lessonId,
                    {
                      language,
                      title: title ?? currentLesson.title,
                      description,
                      name,
                      voiceMode,
                      ttsPreset,
                      customTtsReference,
                    },
                    user,
                  );
                if (aiMentorConfiguration)
                  await this.aiMentorConfigurationService.replaceConfiguration(
                    lessonId,
                    aiMentorConfiguration,
                    user,
                  );
                if (aiJudgeConfiguration)
                  await this.aiJudgeConfigurationService.replaceConfiguration(
                    lessonId,
                    aiJudgeConfiguration,
                    user,
                  );
                if (aiMentorConfiguration || aiJudgeConfiguration)
                  await this.db
                    .update(lessonRows)
                    .set({
                      updatedAt: sql`GREATEST(CURRENT_TIMESTAMP, ${lessonRows.updatedAt} + interval '1 millisecond')`,
                    })
                    .where(eq(lessonRows.id, lessonId));
              },
            );
            return {
              id: lessonId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "create_embed_lesson",
      {
        description:
          "Create an external embed lesson with HTTPS resources through native embed authoring.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createEmbedLessonInputSchema),
      },
      async ({ courseId, chapterId, language, title, resources }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            if (
              course.baseLanguage !== language ||
              !course.chapters.some((chapter) => chapter.id === chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const lesson = await this.lessonService.createEmbedLesson(
              { chapterId, title, type: LESSON_TYPES.EMBED, resources },
              user,
            );
            return {
              id: lesson.id,
              courseId,
              chapterId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lesson.id),
            };
          },
        ),
    );

    server.registerTool(
      "update_embed_lesson",
      {
        description:
          "Update an embed lesson's title and HTTPS resources after checking its revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateEmbedLessonInputSchema),
      },
      async ({ courseId, chapterId, lessonId, language, expectedRevision, title, resources }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLessonType(
              courseId,
              chapterId,
              lessonId,
              language,
              LESSON_TYPES.EMBED,
              user,
            );
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.updateEmbedLesson(lessonId, user, {
                lessonId,
                language,
                title,
                type: LESSON_TYPES.EMBED,
                resources,
              }),
            );
            return {
              id: lessonId,
              language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "create_live_training_lesson",
      {
        description:
          "Create a live training lesson, linking an eligible training or creating one through the native service.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createLiveTrainingLessonInputSchema),
      },
      async ({ courseId, idempotencyKey: _idempotencyKey, ...body }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.LIVE_TRAINING);
            const course = await this.courseService.getBetaCourseById(
              courseId,
              body.language,
              user,
            );
            if (
              course.baseLanguage !== body.language ||
              !course.chapters.some((chapter) => chapter.id === body.chapterId)
            )
              throw new ForbiddenException(
                "Use the course base language and a chapter in this course",
              );
            const result = await this.lessonService.createLiveTrainingLesson(body, user);
            return {
              id: result.lessonId,
              liveTrainingId: result.liveTrainingId,
              courseId,
              chapterId: body.chapterId,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, result.lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "update_live_training_lesson",
      {
        description:
          "Attach an eligible training to another course language of an existing live training lesson.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateLiveTrainingLessonInputSchema),
      },
      async ({ courseId, chapterId, lessonId, expectedRevision, ...body }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.LIVE_TRAINING);
            await this.assertLessonType(
              courseId,
              chapterId,
              lessonId,
              body.language,
              LESSON_TYPES.LIVE_TRAINING,
              user,
            );
            const result = await this.withExpectedRevision(
              ENTITY_TYPES.LESSON,
              lessonId,
              expectedRevision,
              async () => {
                const attached = await this.lessonService.attachLiveTrainingLesson(
                  lessonId,
                  body,
                  user,
                );
                await this.db
                  .update(lessonRows)
                  .set({
                    updatedAt: sql`GREATEST(CURRENT_TIMESTAMP, ${lessonRows.updatedAt} + interval '1 millisecond')`,
                  })
                  .where(eq(lessonRows.id, lessonId));
                return attached;
              },
            );
            return {
              id: lessonId,
              liveTrainingId: result.liveTrainingId,
              language: body.language,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "reorder_lesson",
      {
        description: "Move a lesson to a one-based position within its current chapter.",
        inputSchema: asMcpInputSchema(McpToolSchemas.reorderLessonInputSchema),
      },
      async ({ courseId, chapterId, lessonId, language, displayOrder, expectedRevision }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const chapter = course.chapters.find((item) => item.id === chapterId);
            if (!chapter?.lessons?.some((lesson) => lesson.id === lessonId))
              throw new NotFoundException("Lesson is outside this chapter");
            if (displayOrder > chapter.lessons.length)
              throw new ForbiddenException("Lesson position is outside this chapter");
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.updateLessonDisplayOrder({
                lessonId,
                displayOrder,
                currentUser: user,
              }),
            );
            const updated = await this.courseService.getBetaCourseById(courseId, language, user);
            return {
              chapterId,
              lessonIds:
                updated.chapters
                  .find((item) => item.id === chapterId)
                  ?.lessons?.map((lesson) => lesson.id) ?? [],
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "delete_lesson",
      {
        description:
          "Delete any supported lesson type after confirming its exact title, type, and revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteLessonInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        language,
        expectedRevision,
        confirmTitle,
        confirmType,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const course = await this.courseService.getBetaCourseById(courseId, language, user);
            const lesson = course.chapters
              .find((chapter) => chapter.id === chapterId)
              ?.lessons?.find((item) => item.id === lessonId);
            if (!lesson || lesson.title !== confirmTitle || lesson.type !== confirmType)
              throw new ForbiddenException("Lesson title or type confirmation does not match");
            await this.withExpectedRevision(ENTITY_TYPES.LESSON, lessonId, expectedRevision, () =>
              this.lessonService.removeLesson(lessonId, user),
            );
            return { deletedId: lessonId, chapterId, type: lesson.type };
          },
        ),
    );

    server.registerTool(
      "list_lesson_resources",
      {
        description: "List safe metadata for resources attached to an editable lesson.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listLessonResourcesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ courseId, chapterId, lessonId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLessonInCourse(courseId, chapterId, lessonId, language, user);
            const resources = await this.fileService.getResourcesForEntity(
              lessonId,
              ENTITY_TYPES.LESSON,
              undefined,
              language,
            );
            return {
              lessonId,
              resources: resources.map((resource) => ({
                id: resource.id,
                title: resource.title,
                contentType: resource.contentType,
              })),
            };
          },
        ),
    );

    server.registerTool(
      "insert_lesson_resource",
      {
        description:
          "Place a lesson file after request_authoring_upload has uploaded it. Pass the resourceId from the upload HTTP response, the same lessonId used for the grant, and expectedRevision from get_lesson. A fresh upload is not yet attached; this tool writes its Tiptap node and Mentingo attaches it automatically. preview: images, videos, PDFs, presentations. download: PDFs, presentations, documents.",
        inputSchema: asMcpInputSchema(McpToolSchemas.insertLessonResourceInputSchema),
        annotations: { readOnlyHint: false },
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        resourceId,
        language,
        displayMode,
        expectedRevision,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            const result = await this.withExpectedRevision(
              ENTITY_TYPES.LESSON,
              lessonId,
              expectedRevision,
              async () => {
                const course = await this.courseService.getBetaCourseById(courseId, language, user);
                const lesson = course.chapters
                  .find((chapter) => chapter.id === chapterId)
                  ?.lessons?.find((item) => item.id === lessonId);
                if (!lesson || lesson.type !== LESSON_TYPES.CONTENT)
                  throw new NotFoundException("Content lesson is outside this chapter");
                await this.resourceLibraryService.getAssetUsages(resourceId, language, user);
                const [resource] = await this.db
                  .select({
                    contentType: resourceRows.contentType,
                    name: sql<string>`COALESCE(${resourceRows.title}->>${language}::text, ${resourceRows.metadata}->>'originalFilename', 'Attachment')`,
                  })
                  .from(resourceRows)
                  .where(eq(resourceRows.id, resourceId))
                  .limit(1);
                if (!resource?.contentType)
                  throw new NotFoundException("Uploaded resource not found");
                const currentContent = lesson.description ?? "";
                if (contentReferencesResource(currentContent, resourceId))
                  throw new ConflictException("Resource is already in lesson content");
                const node = renderLessonResourceNode({
                  resourceId,
                  contentType: resource.contentType,
                  name: resource.name || "Attachment",
                  displayMode,
                });
                const description = `${currentContent}${node}`;
                if (description.length > 100000)
                  throw new BadRequestException("Lesson content is too long");
                await this.lessonService.updateLesson(lessonId, { language, description }, user);
                return { displayMode, resourceId };
              },
            );
            return {
              lessonId,
              ...result,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "remove_lesson_resource",
      {
        description:
          "Detach an attached resource after confirming its exact ID and lesson revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeLessonResourceInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({
        courseId,
        chapterId,
        lessonId,
        resourceId,
        language,
        expectedRevision,
        confirmResourceId,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLessonInCourse(courseId, chapterId, lessonId, language, user);
            if (resourceId !== confirmResourceId)
              throw new ForbiddenException("Resource confirmation does not match");
            const attached = await this.fileService.getResourcesForEntity(
              lessonId,
              ENTITY_TYPES.LESSON,
              undefined,
              language,
            );
            if (!attached.some((resource) => resource.id === resourceId))
              throw new NotFoundException("Resource is not attached to this lesson");
            const result = await this.withExpectedRevision(
              ENTITY_TYPES.LESSON,
              lessonId,
              expectedRevision,
              async () => {
                const unlinked = await this.resourceLibraryService.unlinkAsset(
                  resourceId,
                  { entityId: lessonId, entityType: ENTITY_TYPES.LESSON },
                  user,
                );
                if (unlinked.deletedUsages > 0)
                  await this.db
                    .update(lessonRows)
                    .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
                    .where(eq(lessonRows.id, lessonId));
                return unlinked;
              },
            );
            return {
              lessonId,
              resourceId,
              deletedUsages: result.deletedUsages,
              revision: await this.getRevision(ENTITY_TYPES.LESSON, lessonId),
            };
          },
        ),
    );

    server.registerTool(
      "list_qa_entries",
      {
        description:
          "List editable Q&A entries in a language, with IDs and titles. Pages start at 1 and contain up to 50 entries.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listQaEntriesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, page }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          const entries = await this.qaService.getAllQA(language, user);
          const offset = ((page ?? 1) - 1) * 50;
          return {
            entries: entries.slice(offset, offset + 50).map((entry) => ({
              id: entry.id,
              title: entry.title,
              baseLanguage: entry.baseLanguage,
            })),
            total: entries.length,
            page: page ?? 1,
          };
        }),
    );

    server.registerTool(
      "get_qa_entry",
      {
        description: "Read one Q&A question and answer in the selected language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getQaEntryInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ qaId, language }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          return await this.qaService.getQA(qaId, language, user);
        }),
    );

    server.registerTool(
      "create_qa_entry",
      {
        description: "Create a Q&A question and answer in its base language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createQaEntryInputSchema),
      },
      async ({ language, title, description }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          return await this.qaService.createQA({ language, title, description }, user);
        }),
    );

    server.registerTool(
      "update_qa_entry",
      {
        description: "Update a Q&A question or answer in an available language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateQaEntryInputSchema),
      },
      async ({ qaId, language, title, description }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          if (title === undefined && description === undefined)
            throw new ForbiddenException("No changes supplied");
          const updated = await this.qaService.updateQA(
            { title, description },
            qaId,
            language,
            user,
          );
          return { id: updated.id, language };
        }),
    );

    server.registerTool(
      "add_qa_language",
      {
        description: "Add a supported translation language to a Q&A entry.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addQaLanguageInputSchema),
      },
      async ({ qaId, language }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          await this.qaService.createLanguage(qaId, language, user);
          return { qaId, addedLanguage: language };
        }),
    );

    server.registerTool(
      "remove_qa_language",
      {
        description: "Remove a non-base Q&A translation after confirming its language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeQaLanguageInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ qaId, language, confirmLanguage }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          if (language !== confirmLanguage)
            throw new ForbiddenException("Language confirmation does not match");
          await this.qaService.deleteLanguage(qaId, language, user);
          return { qaId, removedLanguage: language };
        }),
    );

    server.registerTool(
      "delete_qa_entry",
      {
        description: "Permanently delete a Q&A entry after confirming its exact title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteQaEntryInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ qaId, language, confirmTitle }) =>
        this.run(actor, [PERMISSIONS.QA_MANAGE], async (user) => {
          await this.assertFeatureEnabled(FEATURES.QA);
          const current = await this.qaService.getQA(qaId, language, user);
          if (current.title !== confirmTitle)
            throw new ForbiddenException("Title confirmation does not match");
          await this.qaService.deleteQA(qaId, user);
          return { deletedId: qaId };
        }),
    );

    server.registerTool(
      "list_article_sections",
      {
        description: "List article sections and their article IDs for the selected language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listArticleSectionsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            return await this.articlesService.getArticlesToc(language, true, user);
          },
        ),
    );

    server.registerTool(
      "get_article_section",
      {
        description: "Read one article section title and language information.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getArticleSectionInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ id, language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const section = await this.articlesService.getArticleSection(id, language, user);
            return {
              id: section.id,
              title: section.title,
              baseLanguage: section.baseLanguage,
              availableLocales: section.availableLocales,
            };
          },
        ),
    );

    server.registerTool(
      "create_article_section",
      {
        description: "Create an article section in the selected base language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createArticleSectionInputSchema),
      },
      async ({ language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const section = await this.articlesService.createArticleSection({ language }, user);
            return { id: section.id, language };
          },
        ),
    );

    server.registerTool(
      "update_article_section",
      {
        description: "Update an article section title in an available language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateArticleSectionInputSchema),
      },
      async ({ id, language, title }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            await this.articlesService.updateArticleSection(
              id,
              { translations: [{ language, title }] },
              user,
            );
            return { id, language, title };
          },
        ),
    );

    server.registerTool(
      "add_article_section_language",
      {
        description: "Add a supported translation language to an article section.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addArticleSectionLanguageInputSchema),
      },
      async ({ id, language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            await this.articlesService.createArticleSectionLanguage(id, { language }, user);
            return { sectionId: id, addedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "remove_article_section_language",
      {
        description: "Remove a non-base article section translation after confirming its language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeArticleSectionLanguageInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmLanguage }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            if (language !== confirmLanguage)
              throw new ForbiddenException("Language confirmation does not match");
            await this.articlesService.deleteArticleSectionLanguage(id, language, user);
            return { sectionId: id, removedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "delete_article_section",
      {
        description: "Delete an empty article section after confirming its exact title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteArticleSectionInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmTitle }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const section = await this.articlesService.getArticleSection(id, language, user);
            if (section.title !== confirmTitle)
              throw new ForbiddenException("Title confirmation does not match");
            await this.articlesService.deleteArticleSection(id, user);
            return { deletedId: id };
          },
        ),
    );

    server.registerTool(
      "get_article",
      {
        description: "Read an article draft or published article for editing.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getArticleInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ id, language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const article = await this.articlesService.getArticle(id, language, true, user);
            return {
              id: article.id,
              title: article.title,
              summary: article.summary,
              content: article.plainContent,
              baseLanguage: article.baseLanguage,
              availableLocales: article.availableLocales,
              sectionId: article.articleSectionId,
              isPublic: article.isPublic,
            };
          },
        ),
    );

    server.registerTool(
      "list_articles",
      {
        description:
          "List manageable published articles and drafts by language, optional status and title query. Pages start at 1 and contain up to 50 articles.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listArticlesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, status, query, page }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const [visible, drafts] = await Promise.all([
              this.articlesService.getArticles(language, user),
              this.articlesService.getDraftArticles(language, user),
            ]);
            const manageable = new Map(
              [...visible, ...drafts].map((article) => [article.id, article]),
            );
            const search = query?.toLocaleLowerCase();
            const filtered = [...manageable.values()].filter(
              (article) =>
                (user.permissions.includes(PERMISSIONS.ARTICLE_MANAGE) ||
                  article.authorId === user.userId) &&
                (!status || article.status === status) &&
                (!search || article.title.toLocaleLowerCase().includes(search)),
            );
            const currentPage = page ?? 1;
            return {
              articles: filtered.slice((currentPage - 1) * 50, currentPage * 50).map((article) => ({
                id: article.id,
                title: article.title,
                status: article.status,
                sectionId: article.articleSectionId,
                isPublic: article.isPublic,
              })),
              total: filtered.length,
              page: currentPage,
            };
          },
        ),
    );

    server.registerTool(
      "create_article",
      {
        description:
          "Create a published article in an existing section, matching the Mentingo article API. It starts with the default title and empty content; use update_article immediately to set its title, summary, and content.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createArticleInputSchema),
      },
      async ({ language, sectionId }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const article = await this.articlesService.createArticle({ language, sectionId }, user);
            return { id: article.id, sectionId, language, status: ARTICLE_STATUS.PUBLISHED };
          },
        ),
    );

    server.registerTool(
      "update_article",
      {
        description:
          "Update an article title, summary, or rich content in one language, and optionally set public visibility.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateArticleInputSchema),
      },
      async ({ id, language, title, summary, content, isPublic }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            if (
              title === undefined &&
              summary === undefined &&
              content === undefined &&
              isPublic === undefined
            )
              throw new ForbiddenException("No changes supplied");
            await this.articlesService.updateArticle(
              id,
              {
                translations:
                  title !== undefined || summary !== undefined || content !== undefined
                    ? [{ language, title, summary, content }]
                    : [],
                isPublic,
              },
              user,
            );
            return { id, language, isPublic };
          },
        ),
    );

    server.registerTool(
      "add_article_language",
      {
        description: "Add a supported translation language to an article.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addArticleLanguageInputSchema),
      },
      async ({ id, language }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            await this.articlesService.createArticleLanguage(id, { language }, user);
            return { articleId: id, addedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "remove_article_language",
      {
        description: "Remove a non-base article translation after confirming its language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeArticleLanguageInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmLanguage }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            if (language !== confirmLanguage)
              throw new ForbiddenException("Language confirmation does not match");
            await this.articlesService.deleteArticleLanguage(id, language, user);
            return { articleId: id, removedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "delete_article",
      {
        description: "Archive an article after confirming its exact title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteArticleInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmTitle }) =>
        this.run(
          actor,
          [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
          async (user) => {
            await this.assertFeatureEnabled(FEATURES.ARTICLES);
            const article = await this.articlesService.getArticle(id, language, true, user);
            if (article.title !== confirmTitle)
              throw new ForbiddenException("Title confirmation does not match");
            await this.articlesService.deleteArticle(id, user);
            return { archivedId: id };
          },
        ),
    );

    server.registerTool(
      "list_news",
      {
        description:
          "List manageable news posts by language and status (draft or published). Defaults to draft. Pages start at 1; the first page has up to 7 posts and later pages up to 9.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listNewsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, status, page }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          const result = await this.newsService.getManageableNewsList(
            language,
            page ?? 1,
            user,
            status ?? NEWS_STATUS.DRAFT,
          );
          return {
            news: result.data.map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              isPublic: item.isPublic,
            })),
            pagination: result.pagination,
          };
        }),
    );

    server.registerTool(
      "get_news",
      {
        description: "Read a manageable news post with editable content.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getNewsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ id, language }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          const news = await this.newsService.getNews(id, language, user);
          if (
            !user.permissions.includes(PERMISSIONS.NEWS_MANAGE) &&
            news.authorId !== user.userId
          ) {
            throw new ForbiddenException("News post is not manageable");
          }
          return {
            id: news.id,
            title: news.title,
            summary: news.summary,
            content: news.plainContent,
            status: news.status,
            isPublic: news.isPublic,
            baseLanguage: news.baseLanguage,
            availableLocales: news.availableLocales,
            revision: await this.getRevision(ENTITY_TYPES.NEWS, id),
          };
        }),
    );

    server.registerTool(
      "create_news",
      {
        description: "Create a news draft in its base language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createNewsInputSchema),
      },
      async ({ language }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          const news = await this.newsService.createNews({ language }, user);
          return { id: news.id, language, status: NEWS_STATUS.DRAFT };
        }),
    );

    server.registerTool(
      "update_news",
      {
        description:
          "Update a news post title, summary, or rich content in one language, and optionally set public visibility.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateNewsInputSchema),
      },
      async ({ id, language, title, summary, content, isPublic, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          if (
            title === undefined &&
            summary === undefined &&
            content === undefined &&
            isPublic === undefined
          )
            throw new ForbiddenException("No changes supplied");
          await this.withExpectedRevision(ENTITY_TYPES.NEWS, id, expectedRevision, () =>
            this.newsService.updateNews(
              id,
              {
                translations:
                  title !== undefined || summary !== undefined || content !== undefined
                    ? [{ language, title, summary, content }]
                    : [],
                isPublic,
              },
              user,
            ),
          );
          return { id, language, revision: await this.getRevision(ENTITY_TYPES.NEWS, id) };
        }),
    );

    server.registerTool(
      "set_news_status",
      {
        description:
          "Publish or return an editable news post to draft. Publishing requires explicit confirmation.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setNewsStatusInputSchema),
      },
      async ({ id, language, status, expectedRevision, confirmPublish }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          const current = await this.newsService.getNews(id, language, user);
          if (
            !user.permissions.includes(PERMISSIONS.NEWS_MANAGE) &&
            current.authorId !== user.userId
          )
            throw new ForbiddenException("News post is not manageable");
          if (status === NEWS_STATUS.PUBLISHED && confirmPublish !== true)
            throw new ForbiddenException("Publishing requires confirmation");
          await this.withExpectedRevision(ENTITY_TYPES.NEWS, id, expectedRevision, () =>
            this.newsService.updateNews(id, { translations: [], status }, user),
          );
          return { id, status, revision: await this.getRevision(ENTITY_TYPES.NEWS, id) };
        }),
    );

    server.registerTool(
      "add_news_language",
      {
        description: "Add a supported translation language to a news post.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addNewsLanguageInputSchema),
      },
      async ({ id, language }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          await this.newsService.createNewsLanguage(id, { language }, user);
          return { newsId: id, addedLanguage: language };
        }),
    );

    server.registerTool(
      "remove_news_language",
      {
        description: "Remove a non-base news translation after confirming its language.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeNewsLanguageInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmLanguage }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          if (language !== confirmLanguage)
            throw new ForbiddenException("Language confirmation does not match");
          await this.newsService.deleteNewsLanguage(id, language, user);
          return { newsId: id, removedLanguage: language };
        }),
    );

    server.registerTool(
      "delete_news",
      {
        description: "Archive a news post after confirming its exact title.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteNewsInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ id, language, confirmTitle }) =>
        this.run(actor, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN], async (user) => {
          await this.assertFeatureEnabled(FEATURES.NEWS);
          const current = await this.newsService.getNews(id, language, user);
          if (current.title !== confirmTitle)
            throw new ForbiddenException("Title confirmation does not match");
          await this.newsService.deleteNews(id, user);
          return { archivedId: id };
        }),
    );

    server.registerTool(
      "list_development_paths",
      {
        description:
          "List manageable development paths by language and optional title query, with IDs, titles and statuses. Pages start at 1 and contain up to 50 paths.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listDevelopmentPathsInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ language, page, query }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            const result = await this.learningPathService.getLearningPaths(
              user,
              page ?? 1,
              50,
              language,
              query,
            );
            const canUpdateAll = user.permissions.includes(PERMISSIONS.LEARNING_PATH_UPDATE);
            return {
              paths: result.data
                .filter((item) => canUpdateAll || item.authorId === user.userId)
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  status: item.status,
                  authorId: item.authorId,
                  baseLanguage: item.baseLanguage,
                })),
              pagination: result.pagination,
            };
          },
        ),
    );

    server.registerTool(
      "get_development_path",
      {
        description: "Read authoring metadata and ordered course IDs for a development path.",
        inputSchema: asMcpInputSchema(McpToolSchemas.getDevelopmentPathInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ pathId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            const path = await this.learningPathService.getLearningPathById(pathId, user, language);
            if (
              !user.permissions.includes(PERMISSIONS.LEARNING_PATH_UPDATE) &&
              path.authorId !== user.userId
            )
              throw new ForbiddenException("Development path is not manageable");
            return {
              id: path.id,
              title: path.title,
              description: path.description,
              status: path.status,
              baseLanguage: path.baseLanguage,
              availableLocales: path.availableLocales,
              sequenceEnabled: path.sequenceEnabled,
              includesCertificate: path.includesCertificate,
              revision: path.updatedAt,
              courses: path.courses.map((course) => ({
                id: course.courseId,
                displayOrder: course.displayOrder,
              })),
            };
          },
        ),
    );

    server.registerTool(
      "create_development_path",
      {
        description:
          "Create a development path with title, description, optional status, sequence and certificate settings. It defaults to draft; publishing requires confirmPublish.",
        inputSchema: asMcpInputSchema(McpToolSchemas.createDevelopmentPathInputSchema),
      },
      async ({ idempotencyKey: _idempotencyKey, confirmPublish, ...body }) =>
        this.run(actor, [PERMISSIONS.LEARNING_PATH_CREATE], async (user) => {
          await this.assertLearningPathsEnabled();
          if (body.status === LEARNING_PATH_STATUSES.PUBLISHED && confirmPublish !== true)
            throw new ForbiddenException("Publishing requires confirmation");
          const path = await this.learningPathService.createLearningPath(body, user);
          return { id: path.id, language: body.language, status: path.status };
        }),
    );

    server.registerTool(
      "update_development_path",
      {
        description:
          "Update localized development path text, sequence and certificate settings, including certificate font color or signature removal.",
        inputSchema: asMcpInputSchema(McpToolSchemas.updateDevelopmentPathInputSchema),
      },
      async ({
        pathId,
        language,
        title,
        description,
        sequenceEnabled,
        includesCertificate,
        settings,
      }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            if (
              [title, description, sequenceEnabled, includesCertificate].every(
                (value) => value === undefined,
              ) &&
              (settings === undefined ||
                Object.values(settings).every((value) => value === undefined))
            )
              throw new ForbiddenException("No changes supplied");
            const path = await this.learningPathService.updateLearningPath(
              pathId,
              { language, title, description, sequenceEnabled, includesCertificate, settings },
              user,
            );
            return { id: path.id, language };
          },
        ),
    );

    server.registerTool(
      "set_development_path_status",
      {
        description:
          "Change a development path's draft, private, or published status after checking its current revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.setDevelopmentPathStatusInputSchema),
      },
      async ({ pathId, language, status, expectedRevision, confirmPublish }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            const current = await this.learningPathService.getLearningPathById(
              pathId,
              user,
              language,
            );
            if (current.updatedAt !== expectedRevision)
              throw new ForbiddenException("Development path changed; read it again");
            if (status === LEARNING_PATH_STATUSES.PUBLISHED && !confirmPublish)
              throw new ForbiddenException("Publication requires confirmation");
            const updated = await this.learningPathService.updateLearningPath(
              pathId,
              { status },
              user,
            );
            return { id: pathId, status: updated.status, revision: updated.updatedAt };
          },
        ),
    );

    server.registerTool(
      "add_development_path_language",
      {
        description: "Add a supported translation language to a development path.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addDevelopmentPathLanguageInputSchema),
      },
      async ({ pathId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            await this.learningPathService.createLanguage(pathId, language, user);
            return { pathId, addedLanguage: language };
          },
        ),
    );

    server.registerTool(
      "list_development_path_courses",
      {
        description: "List course IDs in a development path in their exact display order.",
        inputSchema: asMcpInputSchema(McpToolSchemas.listDevelopmentPathCoursesInputSchema),
        annotations: { readOnlyHint: true },
      },
      async ({ pathId, language }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_COURSE_UPDATE, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            const path = await this.learningPathService.getLearningPathById(pathId, user, language);
            if (
              !user.permissions.includes(PERMISSIONS.LEARNING_PATH_COURSE_UPDATE) &&
              path.authorId !== user.userId
            )
              throw new ForbiddenException("Development path is not manageable");
            return {
              pathId,
              courses: path.courses.map((course) => ({
                courseId: course.courseId,
                displayOrder: course.displayOrder,
              })),
            };
          },
        ),
    );

    server.registerTool(
      "add_courses_to_development_path",
      {
        description: "Add eligible course IDs to a development path.",
        inputSchema: asMcpInputSchema(McpToolSchemas.addCoursesToDevelopmentPathInputSchema),
      },
      async ({ pathId, courseIds }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_COURSE_UPDATE, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            const added = await this.learningPathService.addCoursesToLearningPath(
              pathId,
              { courseIds },
              user,
            );
            return { pathId, addedCourseIds: added.map((item) => item.courseId) };
          },
        ),
    );

    server.registerTool(
      "reorder_development_path_courses",
      {
        description: "Set the exact order of all courses in a development path.",
        inputSchema: asMcpInputSchema(McpToolSchemas.reorderDevelopmentPathCoursesInputSchema),
      },
      async ({ pathId, courseIds }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_COURSE_UPDATE, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            return await this.learningPathService.reorderLearningPathCourses(
              pathId,
              { courseIds },
              user,
            );
          },
        ),
    );

    server.registerTool(
      "remove_course_from_development_path",
      {
        description: "Remove a course from a development path after confirming its ID.",
        inputSchema: asMcpInputSchema(McpToolSchemas.removeCourseFromDevelopmentPathInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ pathId, courseId, confirmCourseId }) =>
        this.run(
          actor,
          [PERMISSIONS.LEARNING_PATH_COURSE_UPDATE, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN],
          async (user) => {
            await this.assertLearningPathsEnabled();
            if (courseId !== confirmCourseId)
              throw new ForbiddenException("Course confirmation does not match");
            await this.learningPathService.removeCourseFromLearningPath(pathId, courseId, user);
            return { pathId, removedCourseId: courseId };
          },
        ),
    );

    server.registerTool(
      "delete_development_path",
      {
        description:
          "Permanently delete a development path after confirming its title and current revision.",
        inputSchema: asMcpInputSchema(McpToolSchemas.deleteDevelopmentPathInputSchema),
        annotations: { destructiveHint: true, idempotentHint: false },
      },
      async ({ pathId, language, confirmTitle, expectedRevision }) =>
        this.run(actor, [PERMISSIONS.LEARNING_PATH_DELETE], async (user) => {
          await this.assertLearningPathsEnabled();
          const current = await this.learningPathService.getLearningPathById(
            pathId,
            user,
            language,
          );
          if (current.title !== confirmTitle || current.updatedAt !== expectedRevision)
            throw new ForbiddenException(
              "Development path confirmation or revision does not match",
            );
          await this.learningPathService.deleteLearningPath(pathId, user);
          return { deletedId: pathId };
        }),
    );

    return server;
  }

  private async run<T extends Record<string, unknown>>(
    actor: McpToolActor,
    requiredPermissions: PermissionKey[],
    operation: (user: CurrentUserType) => Promise<T>,
  ) {
    const call = this.callContext.getStore();
    let auditUser: CurrentUserType = {
      userId: actor.grant.userId,
      tenantId: actor.grant.tenantId,
      email: actor.email,
      roleSlugs: [],
      permissions: [],
    };
    try {
      const access = await this.permissionsService.getUserAccess(actor.grant.userId);
      if (
        requiredPermissions.length > 0 &&
        !hasAnyPermission(access.permissions, requiredPermissions)
      ) {
        throw new ForbiddenException("Missing authoring permission");
      }

      const user: CurrentUserType = {
        userId: actor.grant.userId,
        tenantId: actor.grant.tenantId,
        email: actor.email,
        roleSlugs: access.roleSlugs,
        permissions: access.permissions,
      };
      auditUser = user;
      const result = await this.executeIdempotent(actor, call, () => operation(user));
      await this.auditCall(auditUser, actor, call, "success", result);
      const uploadResult = withMcpUploadInstructions(
        result,
        actor.grant.resource,
        call?.arguments ?? {},
      );
      const response = call ? { ...uploadResult, requestId: call.requestId } : uploadResult;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(response) }],
        structuredContent: response,
      };
    } catch (error) {
      await this.auditCall(auditUser, actor, call, "failure");
      const status = error instanceof HttpException ? error.getStatus() : 500;
      const code =
        status === 400
          ? "INVALID_ARGUMENT"
          : status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "PERMISSION_DENIED"
              : status === 404
                ? "NOT_FOUND"
                : status === 409
                  ? "CONFLICT"
                  : "INTERNAL";
      const rawMessage = error instanceof HttpException ? error.message : "Operation failed";
      const message = /^[\w-]+(?:\.[\w-]+)+$/.test(rawMessage)
        ? "Operation failed; check the supplied data and permissions"
        : rawMessage;
      const failure = { code, status, message, requestId: call?.requestId };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(failure) }],
        isError: true,
      };
    }
  }

  private async executeIdempotent<T extends Record<string, unknown>>(
    actor: McpToolActor,
    call: McpCallContext | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const idempotencyKey = call?.arguments.idempotencyKey;
    if (typeof idempotencyKey !== "string" || !call) return operation();

    const scope = [
      actor.grant.tenantId,
      actor.grant.userId,
      actor.grant.clientId,
      call.tool,
      idempotencyKey,
    ].join(":");
    const key = `mcp:idempotency:${createHash("sha256").update(scope).digest("hex")}`;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          Object.entries(call.arguments).sort(([left], [right]) => left.localeCompare(right)),
        ),
      )
      .digest("hex");
    const pending: McpIdempotencyRecord = { fingerprint, state: "pending" };
    const claimed = await this.redis.set(key, JSON.stringify(pending), { NX: true, EX: 86400 });
    if (!claimed) {
      const stored = await this.redis.get(key);
      if (!stored) throw new ConflictException("Retry state changed; retry the request");
      const record = JSON.parse(stored) as McpIdempotencyRecord;
      if (record.fingerprint !== fingerprint)
        throw new ConflictException("Idempotency key was used with different input");
      if (record.state !== "complete" || !record.result)
        throw new ConflictException("A request with this idempotency key is still in progress");
      return record.result as T;
    }

    let completed = false;
    try {
      const result = await operation();
      completed = true;
      try {
        await this.redis.set(
          key,
          JSON.stringify({ fingerprint, state: "complete", result } satisfies McpIdempotencyRecord),
          { EX: 86400 },
        );
      } catch (error) {
        this.logger.error(
          `Failed to cache MCP idempotency result for ${call.tool}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      return result;
    } catch (error) {
      if (!completed && error instanceof HttpException && error.getStatus() < 500)
        await this.redis.del(key);
      throw error;
    }
  }

  private async auditCall(
    user: CurrentUserType,
    actor: McpToolActor,
    call: McpCallContext | undefined,
    outcome: "success" | "failure",
    result?: Record<string, unknown>,
  ): Promise<void> {
    if (!call || call.tool === "unknown") return;
    const entityId = [
      "lessonId",
      "chapterId",
      "courseId",
      "newsId",
      "qaId",
      "pathId",
      "id",
      "targetId",
    ]
      .map((key) => call.arguments[key])
      .find((value): value is string => typeof value === "string");
    try {
      await this.activityLogsService.recordActivity({
        actor: user,
        operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        resourceType: ACTIVITY_LOG_RESOURCE_TYPES.INTEGRATION,
        context: {
          clientId: actor.grant.clientId,
          tool: call.tool,
          requestId: call.requestId,
          outcome,
          ...(entityId ? { entityId } : {}),
          ...(typeof result?.id === "string" ? { resultId: result.id } : {}),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to audit MCP tool ${call.tool}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async assertLessonInCourse(
    courseId: string,
    chapterId: string,
    lessonId: string,
    language: Parameters<CourseService["getBetaCourseById"]>[1],
    user: CurrentUserType,
  ): Promise<void> {
    const course = await this.courseService.getBetaCourseById(courseId, language, user);
    if (
      !course.chapters
        .find((chapter) => chapter.id === chapterId)
        ?.lessons?.some((lesson) => lesson.id === lessonId)
    )
      throw new NotFoundException("Lesson is outside this chapter");
  }

  private async assertLessonType(
    courseId: string,
    chapterId: string,
    lessonId: string,
    language: Parameters<CourseService["getBetaCourseById"]>[1],
    expectedType: LessonTypes,
    user: CurrentUserType,
  ) {
    const course = await this.courseService.getBetaCourseById(courseId, language, user);
    const lesson = course.chapters
      .find((chapter) => chapter.id === chapterId)
      ?.lessons?.find((item) => item.id === lessonId);
    if (!lesson || lesson.type !== expectedType)
      throw new NotFoundException("Lesson type or parent does not match");
    return lesson;
  }

  private async getRevision(entity: McpRevisionEntity, id: string): Promise<string> {
    const table = this.revisionTable(entity);
    const [row] = await this.db.select().from(table).where(eq(table.id, id));
    if (!row) throw new NotFoundException("Authoring entity not found");
    return createHash("sha256").update(JSON.stringify(row)).digest("hex");
  }

  private async withExpectedRevision<T>(
    entity: McpRevisionEntity,
    id: string,
    expectedRevision: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.tenantDbRunnerService.transactionWithHandle(async (trx) => {
      const table = this.revisionTable(entity);
      const [row] = await trx.select().from(table).where(eq(table.id, id)).for("update");
      if (!row) throw new NotFoundException("Authoring entity not found");
      const currentRevision = createHash("sha256").update(JSON.stringify(row)).digest("hex");
      if (currentRevision !== expectedRevision)
        throw new ConflictException("Authoring entity changed; read it again before editing");
      return operation();
    });
  }

  private revisionTable(entity: McpRevisionEntity) {
    switch (entity) {
      case ENTITY_TYPES.CATEGORY:
        return categoryRows;
      case ENTITY_TYPES.COURSE:
        return courseRows;
      case ENTITY_TYPES.CHAPTER:
        return chapterRows;
      case ENTITY_TYPES.LESSON:
        return lessonRows;
      case ENTITY_TYPES.NEWS:
        return newsRows;
    }
  }

  private async assertFeatureEnabled(
    feature:
      | typeof FEATURES.QA
      | typeof FEATURES.ARTICLES
      | typeof FEATURES.NEWS
      | typeof FEATURES.LIVE_TRAINING,
  ): Promise<void> {
    const settings = await this.settingsService.getGlobalSettings();
    if (!settings[FEATURE_SETTINGS_KEYS[feature]])
      throw new ForbiddenException("Feature is unavailable");
  }

  private async assertLearningPathsEnabled(): Promise<void> {
    const settings = await this.settingsService.getGlobalSettings();
    if (!settings.learningPathsEnabled)
      throw new ForbiddenException("Development paths are unavailable");
  }
}
