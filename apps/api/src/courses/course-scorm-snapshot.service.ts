import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ENTITY_TYPES, SCORM_PACKAGE_ENTITY_TYPE, SCORM_PACKAGE_STATUS } from "@repo/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { groupBy } from "lodash";

import { DatabasePg } from "src/common";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { extractLessonResourceIds } from "src/lesson/lesson-resource-references";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { SettingsService } from "src/settings/settings.service";
import {
  categories,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
} from "src/storage/schema";

import type { CoursesSettings } from "./types/settings";
import type {
  ScormExportAssetReference,
  ScormExportChapterSnapshot,
  ScormExportCourseSnapshot,
  ScormExportLessonSnapshot,
} from "@repo/scorm-export-generator";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CourseScormSnapshotResult = {
  snapshot: ScormExportCourseSnapshot;
  authorId: UUIDType;
};

@Injectable()
export class CourseScormSnapshotService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
    private readonly settingsService: SettingsService,
  ) {}

  async buildSnapshot(
    courseId: UUIDType,
    requestedLanguage?: SupportedLanguages,
  ): Promise<CourseScormSnapshotResult> {
    const course = await this.getCourse(courseId, requestedLanguage);

    if (!course) {
      throw new NotFoundException("adminCourseView.scormExport.error.courseNotFound");
    }

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
      requestedLanguage,
    );

    const [chapterRows, allLessonRows, globalSettings] = await Promise.all([
      this.getChapters(courseId, language),
      this.getCourseLessons(courseId, language),
      this.getGlobalExportSettings(),
    ]);

    const lessonRows = allLessonRows.filter((lesson) => this.isExportableLessonType(lesson.type));

    if (!lessonRows.length) {
      throw new BadRequestException("adminCourseView.scormExport.error.noExportableLessons");
    }

    const lessonIds = lessonRows.map((lesson) => lesson.id);
    const [lessonAssets, quizQuestions, quizOptions, scormScoRows] = await Promise.all([
      this.getLessonAssets(lessonIds, language),
      this.getQuizQuestions(lessonIds, language),
      this.getQuizOptions(lessonIds, language),
      this.getScormScoRows(lessonIds, language),
    ]);

    this.validateRequiredAssets({
      lessonRows,
      lessonAssets,
      quizQuestions,
      scormScoRows,
    });

    const lessonsById = this.buildLessonsById({
      lessonRows,
      lessonAssets,
      quizQuestions,
      quizOptions,
      scormScoRows,
      language,
    });

    const chaptersSnapshot: ScormExportChapterSnapshot[] = chapterRows.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      displayOrder: chapter.displayOrder,
      lessonIds: lessonRows
        .filter((lesson) => lesson.chapterId === chapter.id)
        .map((lesson) => lesson.id),
    }));

    return {
      authorId: course.authorId,
      snapshot: {
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        language,
        thumbnail: this.buildCourseThumbnailAsset(course.thumbnailReference),
        theme: {
          primaryColor: globalSettings.primaryColor,
          contrastColor: globalSettings.contrastColor,
        },
        logo: this.buildAppLogoAsset(globalSettings.platformSimpleLogoS3Key),
        settings: {
          quizFeedbackEnabled: Boolean(course.settings?.quizFeedbackEnabled),
        },
        chapters: chaptersSnapshot,
        lessons: lessonsById,
      },
    };
  }

  private async getCourse(courseId: UUIDType, language?: SupportedLanguages) {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        category: categories.title,
        authorId: courses.authorId,
        settings: sql<CoursesSettings>`${courses.settings}`,
        thumbnailReference: courses.thumbnailS3Key,
      })
      .from(courses)
      .leftJoin(categories, eq(categories.id, courses.categoryId))
      .where(eq(courses.id, courseId));

    return course;
  }

  private async getChapters(courseId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: chapters.id,
        title: this.localizationService.getLocalizedSqlField(chapters.title, language),
        displayOrder: chapters.displayOrder,
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.courseId, courseId))
      .orderBy(chapters.displayOrder);
  }

  private async getCourseLessons(courseId: UUIDType, language: SupportedLanguages) {
    return this.db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        type: sql<string>`${lessons.type}`,
        displayOrder: lessons.displayOrder,
        thresholdScore: lessons.thresholdScore,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.courseId, courseId))
      .orderBy(chapters.displayOrder, lessons.displayOrder);
  }

  private async getGlobalExportSettings() {
    const imageS3Keys = await this.settingsService.getImageS3Keys();
    return {
      platformSimpleLogoS3Key: imageS3Keys.platformSimpleLogoS3Key,
      primaryColor: imageS3Keys.primaryColor,
      contrastColor: imageS3Keys.contrastColor,
    };
  }

  private async getLessonAssets(lessonIds: UUIDType[], language: SupportedLanguages) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        lessonId: resourceEntity.entityId,
        id: resources.id,
        reference: resources.reference,
        contentType: resources.contentType,
        metadata: resources.metadata,
        title: this.localizationService.getLocalizedSqlField(resources.title, language),
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
      .innerJoin(lessons, eq(lessons.id, resourceEntity.entityId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(
        and(
          inArray(resourceEntity.entityId, lessonIds),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
          eq(resources.archived, false),
        ),
      )
      .orderBy(resources.createdAt);
  }

  private async getQuizQuestions(lessonIds: UUIDType[], language: SupportedLanguages) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        id: questions.id,
        lessonId: questions.lessonId,
        type: questions.type,
        title: this.localizationService.getLocalizedSqlField(questions.title, language),
        description: this.localizationService.getLocalizedSqlField(questions.description, language),
        solutionExplanation: this.localizationService.getLocalizedSqlField(
          questions.solutionExplanation,
          language,
        ),
        displayOrder: questions.displayOrder,
        photoS3Key: questions.photoS3Key,
      })
      .from(questions)
      .innerJoin(lessons, eq(lessons.id, questions.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(inArray(questions.lessonId, lessonIds))
      .orderBy(questions.displayOrder);
  }

  private async getQuizOptions(lessonIds: UUIDType[], language: SupportedLanguages) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        id: questionAnswerOptions.id,
        questionId: questionAnswerOptions.questionId,
        title: this.localizationService.getLocalizedSqlField(
          questionAnswerOptions.optionText,
          language,
        ),
        isCorrect: questionAnswerOptions.isCorrect,
        displayOrder: questionAnswerOptions.displayOrder,
        matchedWord: this.localizationService.getLocalizedSqlField(
          questionAnswerOptions.matchedWord,
          language,
        ),
      })
      .from(questionAnswerOptions)
      .innerJoin(questions, eq(questions.id, questionAnswerOptions.questionId))
      .innerJoin(lessons, eq(lessons.id, questions.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(inArray(questions.lessonId, lessonIds))
      .orderBy(questionAnswerOptions.displayOrder);
  }

  private async getScormScoRows(lessonIds: UUIDType[], language: SupportedLanguages) {
    if (!lessonIds.length) return [];

    return this.db
      .select({
        lessonId: scormScos.lessonId,
        packageId: scormPackages.id,
        packageLanguage: scormPackages.language,
        extractedFilesReference: scormPackages.extractedFilesReference,
        scoId: scormScos.id,
        identifier: scormScos.identifier,
        identifierRef: scormScos.identifierRef,
        resourceIdentifier: scormScos.resourceIdentifier,
        title: scormScos.title,
        href: scormScos.href,
        launchPath: scormScos.launchPath,
        displayOrder: scormScos.displayOrder,
        isVisible: scormScos.isVisible,
        resourceMetadataJson: scormScos.resourceMetadataJson,
      })
      .from(scormPackages)
      .innerJoin(scormScos, eq(scormScos.packageId, scormPackages.id))
      .innerJoin(lessons, eq(lessons.id, scormScos.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(
        and(
          inArray(scormScos.lessonId, lessonIds),
          sql`(
            (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.LESSON} AND ${scormPackages.entityId} = ${lessons.id})
            OR (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.COURSE} AND ${scormPackages.entityId} = ${courses.id})
          )`,
          eq(scormPackages.status, SCORM_PACKAGE_STATUS.READY),
          sql`(${scormPackages.language} = ${language} OR ${scormPackages.language} = ${courses.baseLanguage})`,
        ),
      )
      .orderBy(
        sql`CASE WHEN ${scormPackages.language} = ${language} THEN 0 ELSE 1 END`,
        asc(scormScos.displayOrder),
      );
  }

  private buildLessonsById({
    lessonRows,
    lessonAssets,
    quizQuestions,
    quizOptions,
    scormScoRows,
    language,
  }: {
    lessonRows: Awaited<ReturnType<CourseScormSnapshotService["getCourseLessons"]>>;
    lessonAssets: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>;
    quizQuestions: Awaited<ReturnType<CourseScormSnapshotService["getQuizQuestions"]>>;
    quizOptions: Awaited<ReturnType<CourseScormSnapshotService["getQuizOptions"]>>;
    scormScoRows: Awaited<ReturnType<CourseScormSnapshotService["getScormScoRows"]>>;
    language: SupportedLanguages;
  }): Record<string, ScormExportLessonSnapshot> {
    const assetsByLessonId = groupBy(lessonAssets, (asset) => asset.lessonId);
    const questionsByLessonId = groupBy(quizQuestions, (question) => question.lessonId);
    const optionsByQuestionId = groupBy(quizOptions, (option) => option.questionId);
    const scormScosByLessonId = groupBy(scormScoRows, (sco) => sco.lessonId);

    return lessonRows.reduce<Record<string, ScormExportLessonSnapshot>>((acc, lesson) => {
      if (lesson.type === LESSON_TYPES.CONTENT) {
        acc[lesson.id] = {
          id: lesson.id,
          title: lesson.title,
          type: LESSON_TYPES.CONTENT,
          displayOrder: lesson.displayOrder,
          html: lesson.description ?? "",
          assets: (assetsByLessonId[lesson.id] ?? []).map((asset) =>
            this.buildLessonAssetReference(asset),
          ),
        };
      }

      if (lesson.type === LESSON_TYPES.QUIZ) {
        acc[lesson.id] = {
          id: lesson.id,
          title: lesson.title,
          type: LESSON_TYPES.QUIZ,
          displayOrder: lesson.displayOrder,
          passingScorePercent: lesson.thresholdScore,
          questions: (questionsByLessonId[lesson.id] ?? [])
            .filter((question) => question.type !== QUESTION_TYPE.SCALE_1_5)
            .map((question) => ({
              id: question.id,
              type: question.type,
              title: question.title,
              description: question.description,
              solutionExplanation: question.solutionExplanation,
              displayOrder: question.displayOrder,
              options: (optionsByQuestionId[question.id] ?? []).map((option) => ({
                id: option.id,
                title: option.title,
                displayOrder: option.displayOrder,
                isCorrect: option.isCorrect,
                matchedWord: option.matchedWord,
              })),
              correctOptionIds: (optionsByQuestionId[question.id] ?? [])
                .filter((option) => option.isCorrect)
                .map((option) => option.id),
              assets: question.photoS3Key ? [this.buildQuestionAssetReference(question)] : [],
            })),
        };
      }

      if (lesson.type === LESSON_TYPES.EMBED) {
        const [embedResource] = assetsByLessonId[lesson.id] ?? [];
        const metadata = this.getResourceMetadata(embedResource?.metadata);

        acc[lesson.id] = {
          id: lesson.id,
          title: lesson.title,
          type: LESSON_TYPES.EMBED,
          displayOrder: lesson.displayOrder,
          url: embedResource?.reference ?? "",
          allowFullscreen: Boolean(metadata?.allowFullscreen),
        };
      }

      if (lesson.type === LESSON_TYPES.SCORM) {
        const availableLessonScos = scormScosByLessonId[lesson.id] ?? [];
        const exactLanguagePackageId = availableLessonScos.find(
          (sco) => sco.packageLanguage === language,
        )?.packageId;
        const selectedPackageId = exactLanguagePackageId ?? availableLessonScos.at(0)?.packageId;
        const lessonScos = availableLessonScos.filter((sco) => sco.packageId === selectedPackageId);
        const packageMetadata = lessonScos.at(0);

        if (!packageMetadata) return acc;

        acc[lesson.id] = {
          id: lesson.id,
          title: lesson.title,
          type: LESSON_TYPES.SCORM,
          displayOrder: lesson.displayOrder,
          packageId: packageMetadata.packageId,
          extractedFilesReference: packageMetadata.extractedFilesReference,
          scos: lessonScos.map((sco) => ({
            id: sco.scoId,
            title: sco.title,
            identifier: sco.identifier,
            identifierRef: sco.identifierRef,
            resourceIdentifier: sco.resourceIdentifier,
            href: sco.href,
            launchPath: this.stripExtractedFilesReference(
              sco.extractedFilesReference,
              sco.launchPath,
            ),
            files: this.getScormResourceFiles(sco.resourceMetadataJson),
            displayOrder: sco.displayOrder,
            isVisible: sco.isVisible,
          })),
        };
      }

      return acc;
    }, {});
  }

  private buildCourseThumbnailAsset(reference: string | null): ScormExportAssetReference | null {
    if (!reference) return null;

    return {
      id: "course-thumbnail",
      type: "thumbnail",
      sourceReference: reference,
      packagePath: `assets/course/thumbnail/${this.referenceFilename(reference)}`,
    };
  }

  private buildAppLogoAsset(reference: string | null): ScormExportAssetReference | null {
    if (!reference) return null;

    return {
      id: "app-logo",
      type: "logo",
      sourceReference: reference,
      packagePath: `assets/branding/logo/${this.referenceFilename(reference)}`,
    };
  }

  private buildLessonAssetReference(
    asset: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>[number],
  ): ScormExportAssetReference {
    return {
      id: asset.id,
      type: this.isVideoAsset(asset) ? "video" : "contentResource",
      sourceReference: asset.reference,
      packagePath: `assets/lessons/${asset.lessonId}/${this.assetPackageFilename(asset)}`,
      contentType: this.isBunnyReference(asset.reference) ? "video/mp4" : asset.contentType,
    };
  }

  private buildQuestionAssetReference(
    question: Awaited<ReturnType<CourseScormSnapshotService["getQuizQuestions"]>>[number],
  ): ScormExportAssetReference {
    return {
      id: `${question.id}-image`,
      type: "quizResource",
      sourceReference: question.photoS3Key ?? "",
      packagePath: `assets/questions/${question.id}/${this.referenceFilename(
        question.photoS3Key ?? "question-image",
      )}`,
    };
  }

  private validateRequiredAssets({
    lessonRows,
    lessonAssets,
    quizQuestions,
    scormScoRows,
  }: {
    lessonRows: Awaited<ReturnType<CourseScormSnapshotService["getCourseLessons"]>>;
    lessonAssets: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>;
    quizQuestions: Awaited<ReturnType<CourseScormSnapshotService["getQuizQuestions"]>>;
    scormScoRows: Awaited<ReturnType<CourseScormSnapshotService["getScormScoRows"]>>;
  }) {
    const lessonAssetsByLessonId = groupBy(lessonAssets, (asset) => asset.lessonId);
    const scormScosByLessonId = groupBy(scormScoRows, (sco) => sco.lessonId);

    for (const asset of lessonAssets) {
      if (!asset.reference) {
        throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
      }
    }

    for (const question of quizQuestions) {
      if (question.photoS3Key === "") {
        throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
      }
    }

    for (const lesson of lessonRows) {
      if (lesson.type === LESSON_TYPES.CONTENT) {
        this.validateContentLessonResources(lesson, lessonAssetsByLessonId[lesson.id] ?? []);
      }

      if (lesson.type === LESSON_TYPES.EMBED) {
        const [embedResource] = lessonAssetsByLessonId[lesson.id] ?? [];
        if (!embedResource?.reference) {
          throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
        }
      }

      if (lesson.type === LESSON_TYPES.SCORM && !scormScosByLessonId[lesson.id]?.length) {
        throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
      }
    }
  }

  private validateContentLessonResources(
    lesson: Awaited<ReturnType<CourseScormSnapshotService["getCourseLessons"]>>[number],
    lessonAssets: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>,
  ) {
    const referencedResourceIds = extractLessonResourceIds(lesson.description ?? "");
    if (!referencedResourceIds.length) return;

    const availableResourceIds = new Set(lessonAssets.map((asset) => asset.id));
    const hasMissingResource = referencedResourceIds.some(
      (resourceId) => !availableResourceIds.has(resourceId),
    );

    if (hasMissingResource) {
      throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
    }
  }

  private isExportableLessonType(type: string) {
    return (
      type === LESSON_TYPES.CONTENT ||
      type === LESSON_TYPES.QUIZ ||
      type === LESSON_TYPES.EMBED ||
      type === LESSON_TYPES.SCORM
    );
  }

  private getResourceMetadata(metadata: unknown): { allowFullscreen?: boolean } | null {
    if (!metadata || typeof metadata !== "object") return null;
    return metadata as { allowFullscreen?: boolean };
  }

  private assetPackageFilename(
    asset: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>[number],
  ) {
    if (this.isBunnyReference(asset.reference)) {
      return `${asset.id}.mp4`;
    }

    return this.referenceFilename(asset.reference);
  }

  private isVideoAsset(
    asset: Awaited<ReturnType<CourseScormSnapshotService["getLessonAssets"]>>[number],
  ) {
    return this.isBunnyReference(asset.reference) || asset.contentType.startsWith("video/");
  }

  private isBunnyReference(reference: string) {
    return reference.startsWith("bunny-");
  }

  private referenceFilename(reference: string) {
    const [pathWithoutQuery] = reference.split("?");
    const filename = pathWithoutQuery?.split("/").filter(Boolean).at(-1);
    return filename || "asset";
  }

  private getScormResourceFiles(resourceMetadataJson: unknown) {
    if (!resourceMetadataJson || typeof resourceMetadataJson !== "object") return [];

    const files = (resourceMetadataJson as { files?: unknown }).files;
    if (!Array.isArray(files)) return [];

    return files.filter((file): file is string => typeof file === "string" && Boolean(file));
  }

  private stripExtractedFilesReference(extractedFilesReference: string, launchPath: string) {
    const extractedPrefix = `${extractedFilesReference}/`;

    if (!launchPath.startsWith(extractedPrefix)) {
      return launchPath;
    }

    return launchPath.slice(extractedPrefix.length);
  }
}
