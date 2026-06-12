import { Readable } from "stream";

import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { AI_MENTOR_TTS_PRESET, AI_MENTOR_TYPE, AI_MENTOR_VOICE_MODE } from "@repo/shared";
import axios from "axios";
import { load as loadHtml } from "cheerio";
import { count, eq, sql } from "drizzle-orm";
import { validate as uuidValidate } from "uuid";

import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { IngestionService } from "src/ingestion/services/ingestion.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonRepository } from "src/lesson/repositories/adminLesson.repository";
import {
  LUMA_GENERATED_COURSE_AI_MENTOR_TYPES,
  LUMA_GENERATED_COURSE_LESSON_TYPES,
  LUMA_GENERATED_COURSE_QUESTION_TYPES,
} from "src/luma/luma-course-generation-sync.constants";
import { LumaCourseGenerationSyncRepository } from "src/luma/luma-course-generation-sync.repository";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
} from "src/storage/schema";

import type { GeneratedCourseBundleResponse, GeneratedCourseResponse } from "@japro/luma-sdk";
import type { AiMentorTTSPreset, AiMentorType } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LessonTypes } from "src/lesson/lesson.type";
import type {
  BuildImageNodeHtmlData,
  ImportAssetData,
  ImportAssetWithRetryData,
  ImportLessonAssetsData,
  ImportReadyAssetByIdData,
  InsertAiMentorLessonData,
  InsertChapterData,
  InsertContentLessonData,
  InsertLessonData,
  InsertQuestionOptionsData,
  InsertQuizLessonData,
} from "src/luma/luma-generated-course-import.types";
import type {
  LumaGeneratedCourseAiMentorType,
  LumaGeneratedCourseLesson,
  LumaGeneratedCourseImportResult,
  LumaGeneratedCourseImportStats,
  LumaGeneratedCourseQuestionType,
  LumaAiMentorContextIngestion,
} from "src/luma/luma.types";
import type { QuestionType } from "src/questions/schema/question.types";

@Injectable()
export class LumaGeneratedCourseImportService {
  private readonly logger = new Logger(LumaGeneratedCourseImportService.name);

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly fileService: FileService,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly adminLessonRepository: AdminLessonRepository,
    private readonly ingestionService: IngestionService,
    private readonly lumaCourseGenerationSyncRepository: LumaCourseGenerationSyncRepository,
  ) {}

  async importBundle(
    courseId: UUIDType,
    bundle: GeneratedCourseBundleResponse,
    currentUser: CurrentUserType,
  ): Promise<LumaGeneratedCourseImportResult> {
    const contextIngestions: LumaAiMentorContextIngestion[] = [];
    const stats: LumaGeneratedCourseImportStats = { skippedAssetCount: 0 };

    await this.db.transaction(async (trx) => {
      const language = await this.getCourseBaseLanguage(courseId, trx);
      await this.assertCourseHasNoChapters(courseId, trx);
      const assetMap = new Map(bundle.assets.map((asset) => [asset.assetId, asset]));

      for (const [chapterDisplayIndex, chapter] of this.sortChapters(bundle.course).entries()) {
        const chapterId = await this.insertChapter({
          courseId,
          title: chapter.title,
          displayOrder: chapterDisplayIndex + 1,
          language,
          currentUser,
          trx,
        });

        for (const [lessonDisplayIndex, lesson] of this.sortLessons(chapter).entries()) {
          await this.insertLesson({
            chapterId,
            lesson,
            displayOrder: lessonDisplayIndex + 1,
            language,
            currentUser,
            assetMap,
            contextIngestions,
            stats,
            trx,
          });
        }

        await this.updateChapterLessonCount(chapterId, trx);
      }

      await this.updateCourseChapterCount(courseId, trx);
    });

    await this.flushPendingAiMentorContextIngestions(contextIngestions, currentUser);

    return {
      sync: await this.lumaCourseGenerationSyncRepository.markProcessed(courseId, this.db),
      stats,
    };
  }

  private async getCourseBaseLanguage(courseId: UUIDType, trx: DatabasePg) {
    const [course] = await trx
      .select({ baseLanguage: courses.baseLanguage })
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) throw new BadRequestException("adminCourseView.errors.notFound.course");

    return course.baseLanguage;
  }

  private async assertCourseHasNoChapters(courseId: UUIDType, trx: DatabasePg) {
    const [result] = await trx
      .select({ count: count() })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));

    if (result.count > 0) {
      throw new BadRequestException("adminCourseView.toast.courseHasChapters");
    }
  }

  private async insertChapter(data: InsertChapterData) {
    const chapter = await this.adminChapterRepository.createChapterForCourse(
      {
        courseId: data.courseId,
        authorId: data.currentUser.userId,
        title: this.sanitizeText(data.title),
        displayOrder: data.displayOrder,
        language: data.language,
      },
      data.trx,
    );

    return chapter.id;
  }

  private async insertLesson(data: InsertLessonData) {
    const lessonType = this.resolveLessonType(data.lesson);

    if (lessonType === LESSON_TYPES.AI_MENTOR) {
      await this.insertAiMentorLesson(data);
      return;
    }

    if (lessonType === LESSON_TYPES.QUIZ) {
      await this.insertQuizLesson(data);
      return;
    }

    await this.insertContentLesson(data);
  }

  private async insertContentLesson(data: InsertContentLessonData) {
    const description = this.sanitizeText(data.lesson.content ?? "");
    const [lesson] = await data.trx
      .insert(lessons)
      .values({
        chapterId: data.chapterId,
        type: LESSON_TYPES.CONTENT,
        title: buildJsonbField(data.language, this.sanitizeText(data.lesson.title)),
        description: buildJsonbField(data.language, description),
        displayOrder: data.displayOrder,
      })
      .returning({ id: lessons.id });

    await this.importLessonAssets({
      lessonId: lesson.id,
      description,
      lessonAssets: data.lesson.assets,
      language: data.language,
      currentUser: data.currentUser,
      assetMap: data.assetMap,
      stats: data.stats,
      trx: data.trx,
    });
  }

  private async insertAiMentorLesson(data: InsertAiMentorLessonData) {
    const aiMentor = data.lesson.aiMentor;
    const description = this.sanitizeText(aiMentor?.taskDescription ?? data.lesson.content ?? "");
    const [lesson] = await data.trx
      .insert(lessons)
      .values({
        chapterId: data.chapterId,
        type: LESSON_TYPES.AI_MENTOR,
        title: buildJsonbField(data.language, this.sanitizeText(data.lesson.title)),
        description: buildJsonbField(data.language, description, true),
        displayOrder: data.displayOrder,
        isExternal: true,
      })
      .returning({ id: lessons.id });

    await data.trx.insert(aiMentorLessons).values({
      lessonId: lesson.id,
      aiMentorInstructions: this.sanitizeText(aiMentor?.aiMentorInstructions ?? ""),
      completionConditions: this.sanitizeText(aiMentor?.completionConditions ?? ""),
      type: this.mapAiMentorType(aiMentor?.type),
      name: this.sanitizeText(aiMentor?.name ?? "AI Mentor"),
      voiceMode: AI_MENTOR_VOICE_MODE.PRESET,
      ttsPreset: this.mapAiMentorTtsPreset(aiMentor?.ttsPreset),
    });

    const relevantContext = this.getRelevantContext(data.lesson);
    if (relevantContext) {
      data.contextIngestions.push({
        lessonId: lesson.id,
        relevantContext,
      });
    }

    await this.importLessonAssets({
      lessonId: lesson.id,
      description,
      lessonAssets: data.lesson.assets,
      language: data.language,
      currentUser: data.currentUser,
      assetMap: data.assetMap,
      stats: data.stats,
      trx: data.trx,
    });
  }

  private async insertQuizLesson(data: InsertQuizLessonData) {
    const description = this.sanitizeText(data.lesson.content ?? "");
    const [lesson] = await data.trx
      .insert(lessons)
      .values({
        chapterId: data.chapterId,
        type: LESSON_TYPES.QUIZ,
        title: buildJsonbField(data.language, this.sanitizeText(data.lesson.title)),
        description: buildJsonbField(data.language, description),
        displayOrder: data.displayOrder,
        thresholdScore: 0,
        attemptsLimit: null,
        quizCooldownInHours: null,
      })
      .returning({ id: lessons.id });

    const sortedQuestions = [...(data.lesson.questions ?? [])].sort(
      (a, b) => a.questionIndex - b.questionIndex,
    );

    for (const [questionDisplayIndex, question] of sortedQuestions.entries()) {
      const questionType = this.mapQuestionType(question.type);
      const questionOptions = question.options ?? [];

      this.logger.log(
        `Importing generated quiz question: lessonId=${lesson.id}, questionType=${question.type}, mappedType=${questionType}, optionCount=${questionOptions.length}, questionKeys=${this.getObjectKeysForLog(
          question,
        )}`,
      );

      const [createdQuestion] = await data.trx
        .insert(questions)
        .values({
          lessonId: lesson.id,
          authorId: data.currentUser.userId,
          type: questionType,
          title: buildJsonbField(data.language, this.sanitizeText(question.title)),
          description: buildJsonbField(
            data.language,
            this.sanitizeText(question.description ?? ""),
          ),
          solutionExplanation: buildJsonbField(
            data.language,
            this.sanitizeText(question.solutionExplanation ?? ""),
          ),
          displayOrder: question.questionIndex || questionDisplayIndex + 1,
        })
        .returning({ id: questions.id });

      await this.insertQuestionOptions({
        questionId: createdQuestion.id,
        questionType,
        options: questionOptions,
        language: data.language,
        trx: data.trx,
      });
    }

    await this.importLessonAssets({
      lessonId: lesson.id,
      description,
      lessonAssets: data.lesson.assets,
      language: data.language,
      currentUser: data.currentUser,
      assetMap: data.assetMap,
      stats: data.stats,
      trx: data.trx,
    });
  }

  private async insertQuestionOptions(data: InsertQuestionOptionsData) {
    const options = [...(data.options ?? [])].sort((a, b) => a.optionIndex - b.optionIndex);
    const isBlankQuestion =
      data.questionType === QUESTION_TYPE.FILL_IN_THE_BLANKS_DND ||
      data.questionType === QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT;

    for (const [optionDisplayIndex, option] of options.entries()) {
      const optionId = option.blankAnswerId ?? undefined;
      const optionText = option.optionText;

      if (isBlankQuestion && optionId && !this.isUuid(optionId)) {
        throw new BadRequestException("luma.errors.invalidBlankAnswerId");
      }

      if (!optionText) {
        this.logger.warn(
          `Generated quiz option has empty text: questionId=${data.questionId}, optionIndex=${option.optionIndex}, optionKeys=${this.getObjectKeysForLog(option)}`,
        );
      }

      await data.trx.insert(questionAnswerOptions).values({
        id: isBlankQuestion ? optionId : undefined,
        questionId: data.questionId,
        optionText: buildJsonbField(data.language, this.sanitizeText(optionText), true),
        isCorrect: Boolean(option.isCorrect),
        displayOrder: option.optionIndex || optionDisplayIndex + 1,
      });
    }
  }

  private getObjectKeysForLog(value: object) {
    return Object.keys(value).slice(0, 20).join(",");
  }

  private async updateChapterLessonCount(chapterId: UUIDType, trx: DatabasePg) {
    await trx
      .update(chapters)
      .set({
        lessonCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${lessons}
          WHERE ${lessons.chapterId} = ${chapterId}
        )`,
      })
      .where(eq(chapters.id, chapterId));
  }

  private async updateCourseChapterCount(courseId: UUIDType, trx: DatabasePg) {
    await trx
      .update(courses)
      .set({
        chapterCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${chapters}
          WHERE ${chapters.courseId} = ${courseId}
        )`,
      })
      .where(eq(courses.id, courseId));
  }

  private async importLessonAssets(data: ImportLessonAssetsData) {
    const typedAssetIds = this.getLessonAssetIds(data.lessonAssets);
    if (!data.description && !typedAssetIds.length) return;

    const $ = loadHtml(data.description, null, false);
    const assetNodes = $('[data-node-type="luma-asset"]').toArray();
    if (!assetNodes.length && !typedAssetIds.length) return;

    this.logger.log(
      `Importing Luma lesson assets: lessonId=${data.lessonId}, markerCount=${assetNodes.length}, typedAssetCount=${typedAssetIds.length}`,
    );

    let hasChanges = false;
    const markerAssetIds = new Set<string>();

    for (const element of assetNodes) {
      const node = $(element);
      const assetId = node.attr("data-asset-id");
      if (assetId) markerAssetIds.add(assetId);
      const asset = assetId ? data.assetMap.get(assetId) : null;

      if (!assetId || !asset) {
        this.logger.warn(
          `Removing unresolved Luma asset marker: lessonId=${data.lessonId}, assetId=${
            assetId ?? "missing"
          }, reason=${assetId ? "asset_not_ready" : "missing_asset_id"}`,
        );
        data.stats.skippedAssetCount += 1;
        node.remove();
        hasChanges = true;
        continue;
      }

      const resourceId = await this.importAssetWithRetry({
        lessonId: data.lessonId,
        assetId,
        signedUrl: asset.signedUrl,
        currentUser: data.currentUser,
        trx: data.trx,
      });

      if (!resourceId) {
        this.logger.warn(
          `Removing failed Luma asset marker: lessonId=${data.lessonId}, assetId=${assetId}`,
        );
        data.stats.skippedAssetCount += 1;
        node.remove();
        hasChanges = true;
        continue;
      }

      this.logger.log(
        `Replacing Luma asset marker with Core image node: lessonId=${data.lessonId}, assetId=${assetId}, resourceId=${resourceId}`,
      );
      node.replaceWith(
        this.buildImageNodeHtml({
          resourceId,
          alt: assetId,
        }),
      );
      hasChanges = true;
    }

    for (const assetId of typedAssetIds) {
      if (markerAssetIds.has(assetId)) continue;

      const resourceId = await this.importReadyAssetById({
        lessonId: data.lessonId,
        assetId,
        assetMap: data.assetMap,
        currentUser: data.currentUser,
        stats: data.stats,
        trx: data.trx,
      });

      if (!resourceId) continue;

      $.root().append(
        this.buildImageNodeHtml({
          resourceId,
          alt: assetId,
        }),
      );
      hasChanges = true;
    }

    if (!hasChanges) return;

    await data.trx
      .update(lessons)
      .set({
        description: buildJsonbField(data.language, $.html()),
      })
      .where(eq(lessons.id, data.lessonId));
  }

  private getLessonAssetIds(lessonAssets: LumaGeneratedCourseLesson["assets"]) {
    if (!lessonAssets?.length) return [];

    return [
      ...new Set(
        lessonAssets
          .map((asset) => (asset.type === "image" ? asset.assetId : null))
          .filter((assetId): assetId is string => Boolean(assetId)),
      ),
    ];
  }

  private async flushPendingAiMentorContextIngestions(
    contextIngestions: LumaAiMentorContextIngestion[],
    currentUser: CurrentUserType,
  ) {
    if (!contextIngestions.length) return;

    let successfulCount = 0;
    let failedCount = 0;

    for (const contextIngestion of contextIngestions) {
      const file = this.buildMulterTextFile(
        contextIngestion.relevantContext,
        "generated-context.txt",
      );

      try {
        await this.ingestionService.ingestInline(contextIngestion.lessonId, [file], currentUser);
        successfulCount += 1;
      } catch (error) {
        failedCount += 1;
        this.logger.error(
          `Generated AI mentor context ingestion failed: lessonId=${contextIngestion.lessonId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Generated AI mentor context ingestion completed: successful=${successfulCount}, failed=${failedCount}`,
    );
  }

  private async importReadyAssetById(data: ImportReadyAssetByIdData) {
    const asset = data.assetMap.get(data.assetId);
    if (!asset) {
      this.logger.warn(
        `Skipping typed Luma lesson asset without ready bundle asset: lessonId=${data.lessonId}, assetId=${data.assetId}`,
      );
      data.stats.skippedAssetCount += 1;
      return null;
    }

    const resourceId = await this.importAssetWithRetry({
      lessonId: data.lessonId,
      assetId: data.assetId,
      signedUrl: asset.signedUrl,
      currentUser: data.currentUser,
      trx: data.trx,
    });

    if (!resourceId) {
      this.logger.warn(
        `Skipping typed Luma lesson asset after failed import: lessonId=${data.lessonId}, assetId=${data.assetId}`,
      );
      data.stats.skippedAssetCount += 1;
    }

    return resourceId;
  }

  private async importAssetWithRetry(data: ImportAssetWithRetryData) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        this.logger.log(
          `Importing Luma asset: lessonId=${data.lessonId}, assetId=${data.assetId}, attempt=${
            attempt + 1
          }/2`,
        );
        return await this.importAsset(data);
      } catch (error) {
        this.logger.error(
          `Luma asset import failed: lessonId=${data.lessonId}, assetId=${data.assetId}, attempt=${
            attempt + 1
          }/2, reason=${error instanceof Error ? error.message : "unknown"}`,
          error instanceof Error ? error.stack : undefined,
        );
        if (attempt === 1) return null;
      }
    }

    return null;
  }

  private async importAsset(data: ImportAssetData) {
    const file = await this.buildMulterFileFromSignedUrl(data.signedUrl);
    this.logger.log(
      `Downloaded Luma asset: lessonId=${data.lessonId}, assetId=${data.assetId}, contentType=${file.mimetype}, bytes=${file.size}`,
    );
    const { fileKey } = await this.fileService.uploadFile(
      file,
      `${RESOURCE_CATEGORIES.LESSON}/lesson-content`,
      data.currentUser.tenantId,
    );

    const [resource] = await this.adminLessonRepository.createLessonResources(
      data.lessonId,
      [
        {
          reference: fileKey,
          contentType: file.mimetype,
          metadata: {
            originalFilename: file.originalname,
            size: file.size,
            lumaAssetId: data.assetId,
          },
          uploadedById: data.currentUser.userId,
        },
      ],
      data.trx,
    );

    this.logger.log(
      `Imported Luma asset resource: lessonId=${data.lessonId}, assetId=${data.assetId}, resourceId=${resource.id}, fileKey=${fileKey}`,
    );

    return resource.id;
  }

  private buildImageNodeHtml(data: BuildImageNodeHtmlData) {
    const $ = loadHtml("", null, false);
    const node = $("<div></div>");

    node.attr("data-node-type", "image");
    node.attr("data-src", `/api/lesson/lesson-resource/${data.resourceId}`);
    node.attr("data-alt", data.alt);
    node.attr("data-resource-id", data.resourceId);

    return $.html(node);
  }

  private buildMulterTextFile(content: string, filename: string): Express.Multer.File {
    const buffer = Buffer.from(content, "utf-8");

    return {
      fieldname: "file",
      originalname: filename,
      encoding: "7bit",
      mimetype: "text/plain",
      size: buffer.length,
      buffer,
      destination: "",
      filename,
      path: "",
      stream: Readable.from(buffer),
    } as Express.Multer.File;
  }

  private resolveLessonType(
    lesson: GeneratedCourseResponse["chapters"][number]["lessons"][number],
  ): LessonTypes {
    if (lesson.lessonType === LUMA_GENERATED_COURSE_LESSON_TYPES.AI_MENTOR) {
      return LESSON_TYPES.AI_MENTOR;
    }

    if (lesson.lessonType === LUMA_GENERATED_COURSE_LESSON_TYPES.QUIZ) {
      return LESSON_TYPES.QUIZ;
    }

    return LESSON_TYPES.CONTENT;
  }

  private sortChapters(course: GeneratedCourseResponse) {
    return [...course.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex);
  }

  private sortLessons(chapter: GeneratedCourseResponse["chapters"][number]) {
    return [...chapter.lessons].sort((a, b) => {
      const leftIndex = Number(
        (a as Record<string, unknown>).lessonIndex ?? Number.MAX_SAFE_INTEGER,
      );
      const rightIndex = Number(
        (b as Record<string, unknown>).lessonIndex ?? Number.MAX_SAFE_INTEGER,
      );

      return leftIndex - rightIndex;
    });
  }

  private getRelevantContext(
    lesson: GeneratedCourseResponse["chapters"][number]["lessons"][number],
  ) {
    const relevantContext = lesson.aiMentor?.relevantContext;

    if (!relevantContext) return null;

    const sanitizedContext = this.sanitizeText(relevantContext).trim();
    return sanitizedContext.length > 0 ? sanitizedContext : null;
  }

  private mapAiMentorType(type: LumaGeneratedCourseAiMentorType | undefined): AiMentorType {
    if (type === LUMA_GENERATED_COURSE_AI_MENTOR_TYPES.ROLEPLAY) {
      return AI_MENTOR_TYPE.ROLEPLAY;
    }

    if (type === LUMA_GENERATED_COURSE_AI_MENTOR_TYPES.TEACHER) {
      return AI_MENTOR_TYPE.TEACHER;
    }

    return AI_MENTOR_TYPE.MENTOR;
  }

  private mapAiMentorTtsPreset(preset: "male" | "female" | undefined): AiMentorTTSPreset {
    if (preset === AI_MENTOR_TTS_PRESET.FEMALE) return AI_MENTOR_TTS_PRESET.FEMALE;
    return AI_MENTOR_TTS_PRESET.MALE;
  }

  private mapQuestionType(type: LumaGeneratedCourseQuestionType): QuestionType {
    switch (type) {
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.SINGLE_SELECT:
        return QUESTION_TYPE.SINGLE_CHOICE;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.MULTI_SELECT:
        return QUESTION_TYPE.MULTIPLE_CHOICE;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.TRUE_OR_FALSE:
        return QUESTION_TYPE.TRUE_OR_FALSE;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.DETAILED_RESPONSE:
        return QUESTION_TYPE.DETAILED_RESPONSE;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.FILL_IN_THE_BLANKS:
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_DND;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.GAP_FILL:
        return QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT;
      case LUMA_GENERATED_COURSE_QUESTION_TYPES.BRIEF_RESPONSE:
      default:
        return QUESTION_TYPE.BRIEF_RESPONSE;
    }
  }

  private sanitizeText(value?: string | null): string {
    return (value ?? "").replace(/\u0000/g, "");
  }

  private async buildMulterFileFromSignedUrl(signedUrl: string) {
    const response = await axios.get<ArrayBuffer>(signedUrl, {
      responseType: "arraybuffer",
    });

    const contentTypeHeader = response.headers["content-type"];
    const contentType = contentTypeHeader?.split(";")[0] || "application/octet-stream";
    const buffer = Buffer.from(response.data);
    const originalName = this.extractFilenameFromUrl(signedUrl, contentType);

    return {
      fieldname: "file",
      originalname: originalName,
      mimetype: contentType,
      size: buffer.length,
      buffer,
      destination: "",
      filename: originalName,
      path: "",
      stream: Readable.from(buffer),
    } as Express.Multer.File;
  }

  private extractFilenameFromUrl(signedUrl: string, contentType: string) {
    const fallbackByMimeType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
    };

    const url = new URL(signedUrl);
    const lastSegment = url.pathname.split("/").pop();

    if (lastSegment && lastSegment.includes(".")) {
      return lastSegment;
    }

    return `asset.${fallbackByMimeType[contentType] || "bin"}`;
  }

  private isUuid(value: string) {
    return uuidValidate(value);
  }
}
