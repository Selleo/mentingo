/** Applies validated authoring operations to native course, lesson, assessment, and Mentor domains. */
import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  CourseAuthoringOrderError,
  ENTITY_TYPES,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { load as loadHtml } from "cheerio";
import { and, eq, sql, inArray, asc } from "drizzle-orm";

import { AdminChapterService } from "src/chapter/adminChapter.service";
import { DatabasePg } from "src/common";
import {
  getCourseAuthoringBlocks,
  normalizeCourseAuthoringContent,
  replaceCourseAuthoringBlock,
} from "src/common/utils/courseAuthoringBlocks";
import { CourseService } from "src/courses/course.service";
import { DocumentService } from "src/ingestion/services/document.service";
import { AiJudgeConfigurationService } from "src/lesson/ai-judge-configuration/ai-judge-configuration.service";
import { AiMentorConfigurationService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-configuration.service";
import { AdminLessonRepository } from "src/lesson/repositories/adminLesson.repository";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { isOutboxProcessingEnabled } from "src/outbox/outbox.constants";
import { DB } from "src/storage/db/db.providers";
import {
  assessments,
  assessmentQuestions,
  resources,
  aiJudgeConfigurations,
  aiMentorConfigurations,
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  resourceEntity,
} from "src/storage/schema";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import {
  collectAuthoringMediaUrls,
  stripAuthoringHtmlStyles,
  validateAuthoringMedia,
  validateAuthoringHtml,
} from "./course-authoring-html";
import {
  mentorCourseContextKey,
  mentorTargetedContextKey,
} from "./course-authoring-mentor-context";
import {
  orderCourseAuthoringOperations,
  planCourseAuthoringOrder,
} from "./course-authoring-ordering";
import { authoringOperationSchema } from "./schema/course-authoring-operations.schema";

import type {
  PreparedCourseAuthoringApplication,
  AuthoringMentorPayload,
} from "./course-authoring.types";
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";
import type { CourseAuthoringOrderGroup } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
/** Executes the validated export inside the native transaction and records entity mappings. */
export class CourseAuthoringApplyService {
  /** Injects native domain services used within the caller-owned transaction. */
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly contextService: CourseAuthoringContextService,
    private readonly applications: CourseAuthoringApplicationRepository,
    private readonly chapterService: AdminChapterService,
    private readonly lessonService: AdminLessonService,
    private readonly courseService: CourseService,
    private readonly mentorConfigurationService: AiMentorConfigurationService,
    private readonly judgeConfigurationService: AiJudgeConfigurationService,
    private readonly documents: DocumentService,
    private readonly lessonRepository: AdminLessonRepository,
  ) {}

  /** Validates baselines, applies operations, and returns the transaction receipt. */
  async applyPreparedExport(input: PreparedCourseAuthoringApplication, actor: CurrentUserType) {
    await this.contextService.authorize(input.courseId, actor);
    if (!isOutboxProcessingEnabled())
      throw new ServiceUnavailableException("courseAuthoring.errors.outboxUnavailable");
    if (
      !input.operations.length ||
      input.operations.some((operation) => !Value.Check(authoringOperationSchema, operation))
    ) {
      throw new BadRequestException("courseAuthoring.errors.invalidOperations");
    }
    const operationIds = new Set(input.operations.map((operation) => operation.operationId));
    if (operationIds.size !== input.operations.length)
      throw new BadRequestException("courseAuthoring.errors.duplicateOperation");
    if (
      input.operations.some((operation) =>
        operation.dependencies.some((id) => !operationIds.has(id)),
      )
    ) {
      throw new BadRequestException("courseAuthoring.errors.missingDependency");
    }
    return this.applications.applyOnce(
      {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        courseId: input.courseId,
        sessionId: input.sessionId,
        exportId: input.exportId,
        exportHash: input.exportHash,
      },
      async (transaction) => {
        // Serializes competing applies; manual writes are protected by row locks and baseline checks below.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`${actor.tenantId}:course:${input.courseId}`}, 0))`,
        );
        const lockedCourses = await transaction
          .select({ id: courses.id, description: courses.description })
          .from(courses)
          .where(and(eq(courses.id, input.courseId), eq(courses.tenantId, actor.tenantId)))
          .for("update");
        await transaction
          .select({ id: chapters.id })
          .from(chapters)
          .where(eq(chapters.courseId, input.courseId))
          .for("update");
        const lockedLessons = await transaction
          .select({ id: lessons.id, description: lessons.description })
          .from(lessons)
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(chapters.courseId, input.courseId))
          .for("update");
        await transaction
          .select({ id: aiMentorConfigurations.id })
          .from(aiMentorConfigurations)
          .innerJoin(
            aiMentorLessons,
            eq(aiMentorLessons.id, aiMentorConfigurations.aiMentorLessonId),
          )
          .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(chapters.courseId, input.courseId))
          .for("update", { of: aiMentorConfigurations });
        await transaction
          .select({ id: aiJudgeConfigurations.id })
          .from(aiJudgeConfigurations)
          .innerJoin(
            aiMentorLessons,
            eq(aiMentorLessons.id, aiJudgeConfigurations.aiMentorLessonId),
          )
          .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(chapters.courseId, input.courseId))
          .for("update", { of: aiJudgeConfigurations });
        await transaction
          .select({ id: assessments.id })
          .from(assessments)
          .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(chapters.courseId, input.courseId))
          .for("update", { of: assessments });
        await this.contextService.authorize(input.courseId, actor);
        const lockedQuestions = await transaction
          .select({
            prompt: assessmentQuestions.prompt,
            description: assessmentQuestions.description,
          })
          .from(assessmentQuestions)
          .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
          .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(chapters.courseId, input.courseId))
          .for("update", { of: assessmentQuestions });
        const allowedMedia = collectAuthoringMediaUrls([
          ...lockedCourses.flatMap((course) => Object.values(course.description ?? {})),
          ...lockedLessons.flatMap((lesson) => Object.values(lesson.description ?? {})),
          ...lockedQuestions.flatMap((question) => [
            ...Object.values(question.prompt ?? {}),
            ...Object.values(question.description ?? {}),
          ]),
        ]);
        const mappings: Record<string, string> = {};
        const createdIds = new Set(
          input.operations
            .filter(
              (operation) =>
                operation.type === "chapter.create" || operation.type === "lesson.create",
            )
            .map((operation) => operation.targetId),
        );
        const createOperations = input.operations.filter(
          (operation) => operation.type === "chapter.create" || operation.type === "lesson.create",
        );
        if (createdIds.size !== createOperations.length)
          throw new BadRequestException("courseAuthoring.errors.duplicateTarget");
        // Every baseline is checked against the same locked pre-apply state.
        const contexts = new Map<
          AuthoringOperation["language"],
          Awaited<ReturnType<typeof this.contextService.getContext>>
        >();
        for (const language of new Set(input.operations.map((operation) => operation.language))) {
          contexts.set(
            language,
            await this.contextService.getContext(input.courseId, { language }, actor),
          );
        }
        for (const operation of input.operations) {
          const context = contexts.get(operation.language);
          if (!context) throw new BadRequestException("courseAuthoring.errors.invalidOperations");
          const chapter = context.chapters.find((item) => item.id === operation.targetId);
          const lesson = context.chapters
            .flatMap((item) => item.lessons)
            .find((item) => item.id === operation.targetId);
          if (
            !input.acknowledgeAssessmentChanges &&
            ((lesson &&
              lesson.assessmentAttemptCount > 0 &&
              (operation.type === "lesson.update" || operation.type === "lesson.delete")) ||
              (operation.type === "chapter.delete" &&
                chapter?.lessons.some((item) => item.assessmentAttemptCount > 0)))
          )
            throw new ConflictException(
              "courseAuthoring.errors.assessmentAttemptsAcknowledgementRequired",
            );
          let actualHash =
            operation.targetId === input.courseId
              ? context.baselineHash
              : (chapter?.baselineHash ?? lesson?.baselineHash);
          if (operation.type === "chapter.delete") actualHash = chapter?.deletionBaselineHash;
          if (operation.type === "lesson.metadata.update" && !lesson)
            throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
          if (operation.type === "lesson.block.replace" && lesson) {
            if (lesson.lessonType !== "content")
              throw new BadRequestException("courseAuthoring.errors.invalidBlockTarget");
            const [content] = await transaction
              .select({ description: lessons.description })
              .from(lessons)
              .where(eq(lessons.id, operation.targetId));
            actualHash = getCourseAuthoringBlocks(
              content?.description?.[operation.language] ?? "",
            ).find((block) => block.id === operation.payload.blockId)?.baselineHash;
          }
          if (
            (operation.type === "chapter.create" || operation.type === "lesson.create") &&
            actualHash
          ) {
            throw new ConflictException("courseAuthoring.errors.targetAlreadyExists");
          }
          if (operation.type.startsWith("course.") && operation.targetId !== input.courseId) {
            throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
          }
          if (
            operation.type === "course.metadata.update" ||
            operation.type === "course.settings.update"
          ) {
            const fields = Object.keys(operation.payload);
            if (
              !fields.length ||
              fields.some(
                (field) =>
                  !operation.fieldBaselines?.[field] ||
                  operation.fieldBaselines[field] !== context.fieldHashes[field],
              )
            ) {
              throw new ConflictException("courseAuthoring.errors.baselineChanged");
            }
            if (
              Object.keys(operation.fieldBaselines ?? {}).some((field) => !fields.includes(field))
            ) {
              throw new BadRequestException("courseAuthoring.errors.invalidFieldBaseline");
            }
            actualHash = operation.baselineHash ?? undefined;
          }
          if (operation.type === "chapter.reorder") {
            const ids = context.chapters.map((item) => item.id);
            if (
              operation.targetId !== input.courseId ||
              operation.payload.orderedIds.length !== ids.length ||
              operation.payload.orderedIds.some((id) => !ids.includes(id))
            ) {
              throw new BadRequestException("courseAuthoring.errors.invalidReorder");
            }
          }
          if (operation.type === "lesson.reorder") {
            const ids = chapter?.lessons.map((item) => item.id) ?? [];
            if (
              !chapter ||
              operation.payload.orderedIds.length !== ids.length ||
              operation.payload.orderedIds.some((id) => !ids.includes(id))
            ) {
              throw new BadRequestException("courseAuthoring.errors.invalidReorder");
            }
          }
          if (
            operation.type === "lesson.update" &&
            lesson &&
            !chapter &&
            !context.chapters.some(
              (item) =>
                item.id === operation.chapterId &&
                item.lessons.some((entry) => entry.id === lesson.id),
            )
          ) {
            throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
          }
          if (
            operation.type !== "course.metadata.update" &&
            operation.type !== "course.settings.update" &&
            !createdIds.has(operation.targetId) &&
            (!actualHash || actualHash !== operation.baselineHash)
          ) {
            throw new ConflictException("courseAuthoring.errors.baselineChanged");
          }
        }
        try {
          const appliedOperations = orderCourseAuthoringOperations(input.operations);
          for (const operation of appliedOperations)
            await this.execute(operation, input, actor, mappings, allowedMedia);
          const finalChapters = await transaction
            .select({ id: chapters.id })
            .from(chapters)
            .where(eq(chapters.courseId, input.courseId))
            .orderBy(asc(chapters.displayOrder), asc(chapters.id));
          const finalLessons = await transaction
            .select({ id: lessons.id, chapterId: lessons.chapterId })
            .from(lessons)
            .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
            .where(eq(chapters.courseId, input.courseId))
            .orderBy(asc(lessons.displayOrder), asc(lessons.id));
          const groups: CourseAuthoringOrderGroup[] = [
            { kind: "chapter", orderedIds: finalChapters.map((chapter) => chapter.id) },
            ...finalChapters.map((chapter) => ({
              kind: "lesson" as const,
              chapterId: chapter.id,
              orderedIds: finalLessons
                .filter((lesson) => lesson.chapterId === chapter.id)
                .map((lesson) => lesson.id),
            })),
          ];
          const resolvedOperations = appliedOperations.map((operation) => ({
            ...operation,
            targetId: mappings[operation.targetId] ?? operation.targetId,
            ...("chapterId" in operation
              ? { chapterId: mappings[operation.chapterId] ?? operation.chapterId }
              : {}),
            ...(operation.type === "chapter.reorder" || operation.type === "lesson.reorder"
              ? {
                  payload: {
                    orderedIds: operation.payload.orderedIds.map((id) => mappings[id] ?? id),
                  },
                }
              : {}),
          }));
          for (const group of planCourseAuthoringOrder(groups, resolvedOperations))
            for (const [index, id] of group.orderedIds.entries()) {
              if (group.kind === "chapter")
                await this.chapterService.updateChapterDisplayOrder({
                  chapterId: id,
                  displayOrder: index + 1,
                  currentUser: actor,
                });
              else
                await this.lessonService.updateLessonDisplayOrder({
                  lessonId: id,
                  displayOrder: index + 1,
                  currentUser: actor,
                });
            }
          return {
            applicationId: randomUUID(),
            exportHash: input.exportHash,
            status: "applied" as const,
            exportId: input.exportId,
            courseId: input.courseId,
            sessionId: input.sessionId,
            appliedOperationIds: appliedOperations.map((operation) => operation.operationId),
            entityMappings: mappings,
            assetMappings: input.assetMappings,
          };
        } catch (error) {
          if (error instanceof CourseAuthoringOrderError)
            throw new BadRequestException(error.message);
          throw error;
        }
      },
      Object.values(input.assetMappings),
    );
  }

  /** Applies one operation in dependency order using native domain services. */
  private async execute(
    operation: AuthoringOperation,
    input: PreparedCourseAuthoringApplication,
    actor: CurrentUserType,
    mappings: Record<string, string>,
    allowedMedia: ReadonlySet<string>,
  ) {
    const targetId = mappings[operation.targetId] ?? operation.targetId;
    switch (operation.type) {
      case "chapter.create": {
        const chapter = await this.chapterService.createChapterForCourse(
          { courseId: input.courseId, title: operation.payload.title },
          actor,
          operation.language,
        );
        mappings[operation.targetId] = chapter.id;
        return;
      }
      case "chapter.update":
        await this.chapterService.updateChapter(
          targetId,
          { title: operation.payload.title, language: operation.language },
          actor,
        );
        return;
      case "chapter.delete":
        await this.chapterService.removeChapter(targetId, actor);
        return;
      case "lesson.delete":
        await this.lessonService.removeLesson(targetId, actor);
        return;
      case "chapter.reorder":
      case "lesson.reorder":
        return;
      case "course.metadata.update":
        if (typeof operation.payload.description === "string") {
          validateAuthoringHtml(operation.payload.description);
          validateAuthoringMedia(operation.payload.description, allowedMedia, new Set(), new Set());
        }
        await this.courseService.updateCourse(
          input.courseId,
          {
            language: operation.language,
            ...(operation.payload.title === null ? {} : { title: operation.payload.title }),
            ...(operation.payload.description === null
              ? {}
              : {
                  description:
                    typeof operation.payload.description === "string"
                      ? stripAuthoringHtmlStyles(operation.payload.description)
                      : operation.payload.description,
                }),
            ...(operation.payload.learningOutcomes === null
              ? {}
              : { learningOutcomes: operation.payload.learningOutcomes }),
            ...(operation.payload.thumbnailAssetId
              ? { thumbnailS3Key: this.assetKey(operation.payload.thumbnailAssetId, input) }
              : {}),
          },
          actor,
          false,
        );
        return;
      case "course.settings.update": {
        const { certificateSignatureAssetId, certificateValidity, ...settings } = operation.payload;
        if (
          certificateSignatureAssetId &&
          !ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES.some(
            (type) => type === input.assetMimeTypes[certificateSignatureAssetId],
          )
        )
          throw new BadRequestException("courseAuthoring.errors.invalidSignatureType");
        await this.courseService.updateCourseSettings(
          input.courseId,
          {
            ...settings,
            ...(certificateValidity !== undefined
              ? {
                  certificateValidity:
                    certificateValidity?.type === "fixed_date"
                      ? { ...certificateValidity, type: "fixedDate" as const }
                      : certificateValidity,
                }
              : {}),
          },
          actor,
          undefined,
          certificateSignatureAssetId
            ? this.assetKey(certificateSignatureAssetId, input)
            : undefined,
        );
        return;
      }
      case "lesson.metadata.update": {
        let description =
          typeof operation.payload.description === "string"
            ? stripAuthoringHtmlStyles(operation.payload.description)
            : operation.payload.description;
        if (description !== undefined) {
          const [lesson] = await this.db
            .select({ type: lessons.type })
            .from(lessons)
            .where(and(eq(lessons.id, targetId), eq(lessons.tenantId, actor.tenantId)));
          if (!lesson) throw new ConflictException("courseAuthoring.errors.baselineChanged");
          if (lesson.type === "content")
            description = await this.prepareHtml(description, targetId, input, actor, allowedMedia);
          else {
            validateAuthoringHtml(description);
            validateAuthoringMedia(description, allowedMedia, new Set(), new Set());
          }
        }
        await this.lessonService.updateLesson(
          targetId,
          {
            language: operation.language,
            ...(operation.payload.title !== undefined ? { title: operation.payload.title } : {}),
            ...(description !== undefined ? { description } : {}),
          },
          actor,
        );
        return;
      }
      case "lesson.block.replace": {
        const [lesson] = await this.db
          .select({ description: lessons.description })
          .from(lessons)
          .where(and(eq(lessons.id, targetId), eq(lessons.tenantId, actor.tenantId)));
        if (!lesson) throw new ConflictException("courseAuthoring.errors.baselineChanged");
        const description = replaceCourseAuthoringBlock({
          content: lesson.description?.[operation.language] ?? "",
          targetBlockId: operation.payload.blockId,
          replacementHtml: await this.prepareHtml(
            operation.payload.html,
            targetId,
            input,
            actor,
            allowedMedia,
            false,
          ),
        });
        await this.lessonService.updateLesson(
          targetId,
          { language: operation.language, description },
          actor,
        );
        return;
      }
      case "lesson.create":
      case "lesson.update": {
        const chapterId = mappings[operation.chapterId] ?? operation.chapterId;
        const [chapter] = await this.db
          .select({ id: chapters.id })
          .from(chapters)
          .where(and(eq(chapters.id, chapterId), eq(chapters.courseId, input.courseId)));
        if (!chapter) throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
        const payload = operation.payload;
        if (operation.type === "lesson.update") {
          const [existing] = await this.db
            .select({ type: lessons.type })
            .from(lessons)
            .where(eq(lessons.id, targetId));
          if (!existing || existing.type !== payload.lessonType)
            throw new BadRequestException("courseAuthoring.errors.lessonTypeChangeUnsupported");
        }
        if (payload.lessonType === "quiz") {
          for (const html of [
            payload.description,
            ...payload.questions.flatMap((question) => [
              question.prompt,
              question.description ?? "",
              ...question.options.map((option) => option.label),
            ]),
          ]) {
            validateAuthoringHtml(html);
            validateAuthoringMedia(html, allowedMedia, new Set(), new Set());
          }
          const existingImageKeys = [
            ...new Set(
              payload.questions
                .map((question) => question.photoS3Key)
                .filter(
                  (key): key is string => Boolean(key) && !key?.startsWith("authoring-asset:"),
                ),
            ),
          ];
          if (existingImageKeys.length) {
            const authorized = await this.db
              .select({ reference: resources.reference })
              .from(resources)
              .innerJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
              .innerJoin(assessmentQuestions, eq(assessmentQuestions.id, resourceEntity.entityId))
              .innerJoin(assessments, eq(assessments.id, assessmentQuestions.assessmentId))
              .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
              .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
              .where(
                and(
                  eq(chapters.courseId, input.courseId),
                  eq(resourceEntity.entityType, ENTITY_TYPES.ASSESSMENT_QUESTION),
                  inArray(resources.reference, existingImageKeys),
                ),
              );
            if (
              existingImageKeys.some(
                (key) => !authorized.some((resource) => resource.reference === key),
              )
            )
              throw new BadRequestException("courseAuthoring.errors.resourceOutsideCourse");
          }
          const questions = payload.questions.map((question) => ({
            ...question,
            prompt: stripAuthoringHtmlStyles(question.prompt),
            description:
              question.description === null ? null : stripAuthoringHtmlStyles(question.description),
            options: question.options.map((option) => ({
              ...option,
              label: stripAuthoringHtmlStyles(option.label),
            })),
            photoS3Key: question.photoS3Key?.startsWith("authoring-asset:")
              ? this.assetKey(question.photoS3Key.slice("authoring-asset:".length), input)
              : question.photoS3Key,
          }));
          const id = await this.lessonService.saveQuizFromAuthoring(
            {
              ...payload,
              description: stripAuthoringHtmlStyles(payload.description),
              // Frozen authoring exports allow zero for no cooldown; native quiz authoring uses null.
              quizCooldownInHours:
                payload.quizCooldownInHours === 0 ? null : payload.quizCooldownInHours,
              questions,
              chapterId,
              language: operation.language,
            },
            actor,
            operation.type === "lesson.update" ? targetId : undefined,
          );
          mappings[operation.targetId] = id;
          return;
        }
        if (payload.lessonType === "ai_mentor") {
          validateAuthoringHtml(payload.description);
          validateAuthoringMedia(payload.description, allowedMedia, new Set(), new Set());
          const targetedContextIds =
            input.preparedDocumentIds[mentorTargetedContextKey(operation.operationId)] ?? [];
          if (
            (operation.type === "lesson.create" && !payload.judgeConfiguration) ||
            (!targetedContextIds.length &&
              payload.sourceVersionIds.some(
                (id) => !input.preparedDocumentIds[`${operation.operationId}:${id}`]?.length,
              )) ||
            payload.preparedResourceIds.length
          ) {
            throw new BadRequestException("courseAuthoring.errors.mentorPreparationRequired");
          }
          const judgeConfiguration = payload.judgeConfiguration
            ? {
                taskGoal: payload.judgeConfiguration.taskGoal,
                passingThresholdPercent: payload.judgeConfiguration.passingThresholdPercent,
                criteria: payload.judgeConfiguration.criteria.map(
                  ({ ref: _ref, ...criterion }) => criterion,
                ),
                blockingErrors: payload.judgeConfiguration.blockingErrors.map(
                  ({ ref: _ref, ...error }) => error,
                ),
              }
            : null;
          const configuration =
            payload.configurationType === "teacher"
              ? { ...payload.configuration, type: "teacher" as const }
              : { ...payload.configuration, type: "roleplay" as const };
          if (operation.type === "lesson.create") {
            if (!judgeConfiguration)
              throw new BadRequestException("courseAuthoring.errors.mentorJudgeRequired");
            const id = await this.lessonService.createAiMentorLesson(
              {
                chapterId,
                title: payload.title,
                description: stripAuthoringHtmlStyles(payload.description),
                name: payload.name,
                aiMentorConfiguration: configuration,
                aiJudgeConfiguration: judgeConfiguration,
                voiceMode: payload.voiceMode ?? undefined,
                ttsPreset: payload.ttsPreset ?? undefined,
                customTtsReference: payload.customTtsReference ?? undefined,
              },
              actor,
              operation.language,
            );
            mappings[operation.targetId] = id;
          } else {
            const [existingVoice] = await this.db
              .select({
                voiceMode: aiMentorLessons.voiceMode,
                ttsPreset: aiMentorLessons.ttsPreset,
                customTtsReference: aiMentorLessons.customTtsReference,
              })
              .from(aiMentorLessons)
              .where(eq(aiMentorLessons.lessonId, targetId));
            const references = existingVoice?.customTtsReference;
            const existingReference =
              references && typeof references === "object" && operation.language in references
                ? Reflect.get(references, operation.language)
                : undefined;
            await this.lessonService.updateAiMentorLesson(
              targetId,
              {
                title: payload.title,
                description: stripAuthoringHtmlStyles(payload.description),
                name: payload.name,
                language: operation.language,
                voiceMode:
                  payload.voiceMode ??
                  (existingVoice?.voiceMode === "custom" ? "custom" : "preset"),
                ttsPreset:
                  payload.ttsPreset ?? (existingVoice?.ttsPreset === "female" ? "female" : "male"),
                customTtsReference:
                  payload.customTtsReference ??
                  (typeof existingReference === "string" ? existingReference : undefined),
              },
              actor,
            );
            await this.updateMentorConfigurations(targetId, payload, operation.language, actor);
          }
          const [savedMentor] = await this.db
            .select({ id: aiMentorLessons.id })
            .from(aiMentorLessons)
            .where(eq(aiMentorLessons.lessonId, mappings[operation.targetId] ?? targetId));
          if (!savedMentor)
            throw new BadRequestException("courseAuthoring.errors.mentorPreparationRequired");
          if (!targetedContextIds.length)
            for (const sourceId of payload.sourceVersionIds)
              for (const documentId of input.preparedDocumentIds[
                `${operation.operationId}:${sourceId}`
              ] ?? []) {
                await this.documents.assignDocumentToAiMentorLesson(documentId, savedMentor.id);
              }
          const contextDocumentIds = [
            ...targetedContextIds,
            ...(input.preparedDocumentIds[mentorCourseContextKey(operation.operationId)] ?? []),
          ];
          await this.documents.replaceCourseAuthoringMentorContext(
            [...new Set(contextDocumentIds)],
            savedMentor.id,
            actor.tenantId,
          );
          if (payload.avatarAssetId)
            await this.db
              .update(aiMentorLessons)
              .set({ avatarReference: this.assetKey(payload.avatarAssetId, input) })
              .where(eq(aiMentorLessons.lessonId, mappings[operation.targetId] ?? targetId));
          return;
        }
        if (operation.type === "lesson.create") {
          const id = await this.lessonService.createLessonForChapter(
            { chapterId, type: "content", title: payload.title, description: "" },
            actor,
            operation.language,
          );
          mappings[operation.targetId] = id;
          // Resource rows reference the persisted lesson, so stage HTML assets only after
          // the native lesson exists. Both writes remain inside the export transaction.
          const description = await this.prepareHtml(
            payload.description,
            id,
            input,
            actor,
            allowedMedia,
          );
          await this.lessonService.updateLesson(
            id,
            { language: operation.language, description },
            actor,
          );
        } else {
          const description = await this.prepareHtml(
            payload.description,
            targetId,
            input,
            actor,
            allowedMedia,
          );
          await this.lessonService.updateLesson(
            targetId,
            {
              language: operation.language,
              title: payload.title,
              description,
            },
            actor,
          );
        }
        return;
      }
    }
  }

  /** Reconciles Mentor and judge configuration while preserving translation structure. */
  private async updateMentorConfigurations(
    lessonId: string,
    payload: AuthoringMentorPayload,
    language: AuthoringOperation["language"],
    actor: CurrentUserType,
  ) {
    const current = await this.mentorConfigurationService.getConfiguration(
      lessonId,
      actor,
      language,
    );
    const configuration =
      payload.configurationType === "teacher"
        ? { ...payload.configuration, type: "teacher" as const }
        : { ...payload.configuration, type: "roleplay" as const };
    if (language === current.baseLanguage)
      await this.mentorConfigurationService.replaceConfiguration(lessonId, configuration, actor);
    else {
      if (configuration.type !== current.type)
        throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
      if (configuration.type === "teacher" && current.type === "teacher") {
        const { teachingStyle, ...translation } = configuration;
        if (teachingStyle !== current.teachingStyle)
          throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
        await this.mentorConfigurationService.updateTranslations(
          lessonId,
          language,
          translation,
          actor,
        );
      } else if (configuration.type === "roleplay" && current.type === "roleplay") {
        const { difficulty, ...translation } = configuration;
        if (difficulty !== current.difficulty)
          throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
        await this.mentorConfigurationService.updateTranslations(
          lessonId,
          language,
          translation,
          actor,
        );
      }
    }
    if (!payload.judgeConfiguration) return;
    const currentJudge = await this.judgeConfigurationService.getConfiguration(
      lessonId,
      actor,
      language,
    );
    const judge = payload.judgeConfiguration;
    if (
      new Set(judge.criteria.map((item) => item.ref)).size !== judge.criteria.length ||
      new Set(judge.blockingErrors.map((item) => item.ref)).size !== judge.blockingErrors.length
    )
      throw new BadRequestException("courseAuthoring.errors.duplicateJudgeReference");
    const criteria = judge.criteria.map(({ ref, ...criterion }) => {
      const existing = currentJudge?.criteria[Number(ref.slice(1)) - 1];
      return {
        ...criterion,
        ...(existing ? { id: existing.id } : {}),
        scoreGuidance: criterion.scoreGuidance.map((guidance) => {
          const previous = existing?.scoreGuidance.find((item) => item.score === guidance.score);
          return { ...guidance, ...(previous ? { id: previous.id } : {}) };
        }),
      };
    });
    const blockingErrors = judge.blockingErrors.map(({ ref, ...error }) => {
      const existing = currentJudge?.blockingErrors[Number(ref.slice(1)) - 1];
      return { ...error, ...(existing ? { id: existing.id } : {}) };
    });
    if (language === current.baseLanguage) {
      await this.judgeConfigurationService.replaceConfiguration(
        lessonId,
        {
          taskGoal: judge.taskGoal,
          passingThresholdPercent: judge.passingThresholdPercent,
          criteria,
          blockingErrors,
        },
        actor,
      );
      return;
    }
    if (
      !currentJudge ||
      criteria.length !== currentJudge.criteria.length ||
      blockingErrors.length !== currentJudge.blockingErrors.length ||
      judge.passingThresholdPercent !== currentJudge.passingThresholdPercent ||
      criteria.some((criterion) => {
        const original = currentJudge.criteria.find((item) => item.id === criterion.id);
        return (
          !original ||
          original.maxScore !== criterion.maxScore ||
          original.scoreGuidance.length !== criterion.scoreGuidance.length ||
          criterion.scoreGuidance.some((item) => !item.id)
        );
      }) ||
      blockingErrors.some((error) => !error.id)
    )
      throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
    await this.judgeConfigurationService.updateTranslations(
      lessonId,
      language,
      {
        taskGoal: judge.taskGoal,
        criteria: criteria.map((criterion) => {
          if (!criterion.id)
            throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
          return {
            id: criterion.id,
            title: criterion.title,
            expectedBehavior: criterion.expectedBehavior,
          };
        }),
        scoreGuidance: criteria.flatMap((criterion) =>
          criterion.scoreGuidance.map((guidance) => {
            if (!guidance.id)
              throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
            return {
              id: guidance.id,
              description: guidance.description,
              example: guidance.example,
            };
          }),
        ),
        blockingErrors: blockingErrors.map((error) => {
          if (!error.id)
            throw new BadRequestException("courseAuthoring.errors.translationStructureChanged");
          return { id: error.id, description: error.description };
        }),
      },
      actor,
    );
  }

  /** Validates existing resources and replaces staged authoring assets in lesson HTML. */
  private async prepareHtml(
    content: string,
    lessonId: string,
    input: PreparedCourseAuthoringApplication,
    actor: CurrentUserType,
    allowedMedia: ReadonlySet<string>,
    assignBlocks = true,
  ) {
    validateAuthoringHtml(content);
    const $ = loadHtml(content);
    const existingIds = [
      ...new Set(
        $("[data-resource-id]")
          .toArray()
          .map((element) => $(element).attr("data-resource-id"))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (existingIds.length) {
      const authorized = await this.db
        .select({ id: resourceEntity.resourceId })
        .from(resourceEntity)
        .innerJoin(lessons, eq(lessons.id, resourceEntity.entityId))
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(
          and(
            eq(chapters.courseId, input.courseId),
            eq(resourceEntity.entityType, "lesson"),
            inArray(resourceEntity.resourceId, existingIds),
          ),
        );
      if (existingIds.some((id) => !authorized.some((resource) => resource.id === id)))
        throw new BadRequestException("courseAuthoring.errors.resourceOutsideCourse");
    }
    validateAuthoringMedia(
      content,
      allowedMedia,
      new Set(existingIds),
      new Set(Object.keys(input.assetMappings)),
    );
    $("[style]").removeAttr("style");
    for (const element of $("[data-authoring-asset-id]").toArray()) {
      const node = $(element);
      const assetId = node.attr("data-authoring-asset-id");
      if (!assetId) throw new BadRequestException("courseAuthoring.errors.assetNotReady");
      const [resource] = await this.lessonRepository.createLessonResources(lessonId, [
        {
          reference: this.assetKey(assetId, input),
          contentType: input.assetMimeTypes[assetId],
          uploadedById: actor.userId,
          metadata: { authoringAssetId: assetId, exportId: input.exportId },
        },
      ]);
      const replacement = $("<div></div>");
      replacement
        .attr("data-node-type", "image")
        .attr("data-src", `/api/lesson/lesson-resource/${resource.id}`)
        .attr("data-resource-id", resource.id)
        .attr("data-alt", node.attr("alt") ?? "");
      const blockId = node.attr("data-authoring-block-id");
      if (blockId) replacement.attr("data-authoring-block-id", blockId);
      node.replaceWith(replacement);
    }
    const html = $("body").html() ?? "";
    return assignBlocks ? normalizeCourseAuthoringContent(html) : html;
  }

  /** Resolves a staged asset to its tenant-prefixed storage key or rejects it. */
  private assetKey(assetId: string, input: PreparedCourseAuthoringApplication) {
    const key = input.assetMappings[assetId];
    if (!key) throw new BadRequestException("courseAuthoring.errors.assetNotReady");
    return key;
  }
}
