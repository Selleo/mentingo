import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES, type LocalizedText, type SupportedLanguages } from "@repo/shared";
import { load as loadHtml } from "cheerio";
import { count, eq, inArray, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import { createLessonResourceIdRegex } from "src/lesson/lesson-resource-references";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { chapters, courses, lessons, questions } from "src/storage/schema";

import { DURATION_DEFAULTS } from "./constants/duration-defaults";

import type {
  CourseDurationEstimatesByLanguage,
  CourseDurationHierarchy,
  DurationEstimatesByCourse,
} from "./types/duration";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseDurationService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getCourseDurationHierarchy(
    courseId: UUIDType,
    language: SupportedLanguages | undefined,
    dbInstance: DatabasePg = this.db,
  ): Promise<CourseDurationHierarchy> {
    const courseLessonIds = dbInstance
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, courseId));

    const questionCounts = dbInstance
      .select({
        lessonId: questions.lessonId,
        questionCount: count(questions.id).as("questionCount"),
      })
      .from(questions)
      .where(inArray(questions.lessonId, courseLessonIds))
      .groupBy(questions.lessonId)
      .as("question_counts");

    const lessonRows = await dbInstance
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        type: lessons.type,
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        questionCount: sql<number>`COALESCE(${questionCounts.questionCount}, 0)`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(questionCounts, eq(questionCounts.lessonId, lessons.id))
      .where(eq(chapters.courseId, courseId));

    const result: CourseDurationHierarchy = {
      totalSeconds: 0,
      byChapterId: {},
      byLessonId: {},
    };

    for (const lesson of lessonRows) {
      const estimatedSeconds = this.getLessonSeconds({
        descriptionHtml: lesson.description,
        quizQuestionCount: Number(lesson.questionCount) || 0,
        lessonType: lesson.type,
      });

      result.byLessonId[lesson.id] = estimatedSeconds;
      result.byChapterId[lesson.chapterId] =
        (result.byChapterId[lesson.chapterId] ?? 0) + estimatedSeconds;
      result.totalSeconds += estimatedSeconds;
    }

    return result;
  }

  async getCourseDurationEstimates(
    courseIds: UUIDType[],
    language: SupportedLanguages | undefined,
    dbInstance: DatabasePg = this.db,
  ): Promise<DurationEstimatesByCourse> {
    if (!courseIds.length) return {};

    const durationLanguage = language ?? SUPPORTED_LANGUAGES.EN;
    const courseRows = await dbInstance
      .select({
        id: courses.id,
        durationEstimates: courses.durationEstimates,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    return Object.fromEntries(
      courseRows.map((course) => [
        course.id,
        course.durationEstimates[durationLanguage] ?? { totalMinutes: 0 },
      ]),
    );
  }

  async refreshCourseDurationEstimates(
    courseId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<void> {
    const estimates = await this.computeCourseDurationEstimates([courseId], dbInstance);
    const durationEstimates = estimates[courseId];
    if (!durationEstimates) return;

    await dbInstance
      .update(courses)
      .set({
        durationEstimates,
        updatedAt: sql`${courses.updatedAt}`,
      })
      .where(eq(courses.id, courseId));
  }

  private async computeCourseDurationEstimates(
    courseIds: UUIDType[],
    dbInstance: DatabasePg,
  ): Promise<Record<UUIDType, CourseDurationEstimatesByLanguage>> {
    const courseRows = await dbInstance
      .select({
        id: courses.id,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    if (!courseRows.length) return {};

    const scopedLessonIds = dbInstance
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(inArray(chapters.courseId, courseIds));

    const questionCounts = dbInstance
      .select({
        lessonId: questions.lessonId,
        questionCount: count(questions.id).as("questionCount"),
      })
      .from(questions)
      .where(inArray(questions.lessonId, scopedLessonIds))
      .groupBy(questions.lessonId)
      .as("question_counts");

    const lessonRows = await dbInstance
      .select({
        courseId: chapters.courseId,
        type: lessons.type,
        description: lessons.description,
        questionCount: sql<number>`COALESCE(${questionCounts.questionCount}, 0)`,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(questionCounts, eq(questionCounts.lessonId, lessons.id))
      .where(inArray(chapters.courseId, courseIds));

    const courseLocalization = new Map(
      courseRows.map((course) => [
        course.id,
        {
          baseLanguage: course.baseLanguage,
          availableLocales: course.availableLocales,
        },
      ]),
    );
    const secondsByCourseAndLanguage = new Map<string, number>();

    for (const lesson of lessonRows) {
      const localization = courseLocalization.get(lesson.courseId);
      if (!localization) continue;

      for (const language of Object.values(SUPPORTED_LANGUAGES)) {
        const description = this.getLocalizedDescription(
          lesson.description,
          language,
          localization.baseLanguage,
          localization.availableLocales,
        );
        const lessonSeconds = this.getLessonSeconds({
          descriptionHtml: description,
          quizQuestionCount: Number(lesson.questionCount) || 0,
          lessonType: lesson.type,
        });
        const key = this.getCourseLanguageKey(lesson.courseId, language);

        secondsByCourseAndLanguage.set(
          key,
          (secondsByCourseAndLanguage.get(key) ?? 0) + lessonSeconds,
        );
      }
    }

    return Object.fromEntries(
      courseRows.map((course) => [
        course.id,
        Object.fromEntries(
          Object.values(SUPPORTED_LANGUAGES).map((language) => {
            const totalSeconds =
              secondsByCourseAndLanguage.get(this.getCourseLanguageKey(course.id, language)) ?? 0;

            return [
              language,
              { totalMinutes: totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : 0 },
            ];
          }),
        ) as CourseDurationEstimatesByLanguage,
      ]),
    );
  }

  private getLocalizedDescription(
    description: LocalizedText | null,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
    availableLocales: SupportedLanguages[],
  ): string {
    if (!description) return "";

    if (availableLocales.includes(language)) {
      return description[language] ?? description[baseLanguage] ?? "";
    }

    return description[baseLanguage] ?? "";
  }

  private getLessonSeconds(params: {
    descriptionHtml?: string | null;
    quizQuestionCount: number;
    lessonType: string;
  }): number {
    const { descriptionHtml, quizQuestionCount, lessonType } = params;
    const content = descriptionHtml ?? "";
    const wordCount = this.countWordsFromHtml(content);
    const readingSeconds = Math.ceil((wordCount / DURATION_DEFAULTS.wordsPerMinute) * 60);
    const embeddedCounts = this.countEmbeddedResourcesFromHtml(content);

    return match(lessonType)
      .with(
        LESSON_TYPES.CONTENT,
        () =>
          readingSeconds +
          embeddedCounts.video * DURATION_DEFAULTS.videoMinutes * 60 +
          embeddedCounts.image * DURATION_DEFAULTS.imageSeconds +
          embeddedCounts.download * DURATION_DEFAULTS.downloadSeconds +
          embeddedCounts.presentation * DURATION_DEFAULTS.embedMinutes * 60 +
          quizQuestionCount * DURATION_DEFAULTS.quizSeconds,
      )
      .with(
        LESSON_TYPES.QUIZ,
        () => readingSeconds + quizQuestionCount * DURATION_DEFAULTS.quizSeconds,
      )
      .with(LESSON_TYPES.AI_MENTOR, () => readingSeconds + DURATION_DEFAULTS.aiMentorMinutes * 60)
      .with(LESSON_TYPES.EMBED, () => readingSeconds + DURATION_DEFAULTS.embedMinutes * 60)
      .otherwise(() => readingSeconds);
  }

  private countWordsFromHtml(content: string): number {
    const $ = loadHtml(content);
    return $.text().trim().split(/\s+/).filter(Boolean).length;
  }

  private countEmbeddedResourcesFromHtml(content: string): {
    video: number;
    image: number;
    download: number;
    presentation: number;
  } {
    const { contentCount } = injectResourcesIntoContent(content, [], {
      resourceIdRegex: createLessonResourceIdRegex(),
      trackNodeTypes: ["video", "image", "downloadable-file", "presentation"],
      convertImageAnchors: false,
    });

    return {
      video: Number(contentCount.video) || 0,
      image: Number(contentCount.image) || 0,
      download: Number(contentCount["downloadable-file"]) || 0,
      presentation: Number(contentCount.presentation) || 0,
    };
  }

  private getCourseLanguageKey(courseId: UUIDType, language: SupportedLanguages): string {
    return `${courseId}:${language}`;
  }
}
