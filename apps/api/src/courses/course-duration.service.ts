import { Injectable } from "@nestjs/common";

import { CourseDurationRepository } from "./course-duration.repository";
import {
  calculateLessonDurationSeconds,
  emptyLanguageEstimates,
  extractEmbeddedResourceIds,
  getEstimate,
  getLocalizedDurationDescription,
  roundChapterDurationForDisplay,
  selectDurationLanguage,
} from "./utils/course-duration.utils";

import type {
  CourseDurationHierarchy,
  DurationDb,
  DurationEstimatesByCourse,
  DurationEstimatesByLanguage,
  DurationLessonRow,
  DurationProjection,
  DurationResource,
} from "./types/duration";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseDurationService {
  constructor(private readonly courseDurationRepository: CourseDurationRepository) {}

  async getCourseDurationHierarchy(
    courseId: UUIDType,
    language: SupportedLanguages | undefined,
    dbInstance?: DurationDb,
  ): Promise<CourseDurationHierarchy> {
    const [course] = await this.courseDurationRepository.getCourseLocalization(
      courseId,
      dbInstance,
    );
    if (!course) return { totalSeconds: 0, byChapterId: {}, byLessonId: {} };

    const selectedLanguage = selectDurationLanguage(course, language);
    const chapterRows = await this.courseDurationRepository.getChapterDurationRows(
      courseId,
      dbInstance,
    );
    const lessonRows = await this.courseDurationRepository.getLessonDurationRows(
      courseId,
      dbInstance,
    );
    const byChapterId: Record<UUIDType, number> = {};
    const byLessonId: Record<UUIDType, number> = {};

    for (const chapter of chapterRows)
      byChapterId[chapter.id] = this.getEstimateSeconds(
        chapter.durationEstimates,
        selectedLanguage,
      );
    for (const lesson of lessonRows)
      byLessonId[lesson.id] = this.getEstimateSeconds(lesson.durationEstimates, selectedLanguage);

    return {
      totalSeconds: Object.values(byChapterId).reduce((sum, seconds) => sum + seconds, 0),
      byChapterId,
      byLessonId,
    };
  }

  async getCourseDurationEstimates(
    courseIds: UUIDType[],
    language: SupportedLanguages | undefined,
    dbInstance?: DurationDb,
  ): Promise<DurationEstimatesByCourse> {
    if (!courseIds.length) return {};
    const courseRows = await this.courseDurationRepository.getCourseDurationRows(
      courseIds,
      dbInstance,
    );
    return Object.fromEntries(
      courseRows.map((course) => [
        course.id,
        getEstimate(course.durationEstimates, selectDurationLanguage(course, language)),
      ]),
    );
  }

  /** List endpoints retain minutes, derived from exact chapter projections. */
  async getCourseDurationDisplayMinutes(
    courseIds: UUIDType[],
    language: SupportedLanguages | undefined,
    dbInstance?: DurationDb,
  ): Promise<Record<UUIDType, number>> {
    if (!courseIds.length) return {};
    const courseRows = await this.courseDurationRepository.getCourseDurationRows(
      courseIds,
      dbInstance,
    );
    const languageByCourse = new Map(
      courseRows.map((course) => [course.id, selectDurationLanguage(course, language)]),
    );
    const chapterRows = await this.courseDurationRepository.getChapterDurationRowsForCourses(
      courseIds,
      dbInstance,
    );
    const result: Record<UUIDType, number> = {};
    for (const chapter of chapterRows) {
      const selectedLanguage = languageByCourse.get(chapter.courseId);
      if (!selectedLanguage) continue;
      const seconds = this.getEstimateSeconds(chapter.durationEstimates, selectedLanguage);
      result[chapter.courseId] =
        (result[chapter.courseId] ?? 0) + roundChapterDurationForDisplay(seconds) / 60;
    }
    return result;
  }

  async refreshCourseDurationEstimates(courseId: UUIDType, dbInstance?: DurationDb): Promise<void> {
    await this.courseDurationRepository.withCourseDurationTransaction(
      courseId,
      dbInstance,
      async (trx) => {
        const projection = await this.computeProjection(courseId, trx);
        if (!projection) return;
        const lessonUpdates = [...projection.lessons].map(([id, durationEstimates]) => ({
          id,
          durationEstimates,
        }));
        if (lessonUpdates.length)
          await this.courseDurationRepository.updateLessonDurations(lessonUpdates, trx);
        const chapterUpdates = [...projection.chapters].map(([id, durationEstimates]) => ({
          id,
          durationEstimates,
        }));
        if (chapterUpdates.length)
          await this.courseDurationRepository.updateChapterDurations(chapterUpdates, trx);
        const durationEstimates = projection.courses.get(courseId);
        if (durationEstimates)
          await this.courseDurationRepository.updateCourseDuration(
            courseId,
            durationEstimates,
            trx,
          );
      },
    );
  }

  async refreshCoursesForResource(resourceId: UUIDType, dbInstance?: DurationDb): Promise<void> {
    const relationRows = await this.courseDurationRepository.getResourceRelations(
      resourceId,
      dbInstance,
    );
    const references = [resourceId, ...relationRows.map((relation) => relation.resourceEntityId)];
    const contentRows = await this.courseDurationRepository.getLessonsReferencingResourceContent(
      resourceId,
      dbInstance,
    );
    const relationRowsByLesson = relationRows.length
      ? await this.courseDurationRepository.getLessonsByIds(
          relationRows.map((relation) => relation.entityId),
          dbInstance,
        )
      : [];
    const lessonRows = [...contentRows, ...relationRowsByLesson];
    const courseIds = [
      ...new Set(
        lessonRows
          .filter((lesson) =>
            Object.values(lesson.description ?? {}).some((content) =>
              references.some((reference) => content.includes(reference)),
            ),
          )
          .map((lesson) => lesson.courseId),
      ),
    ];
    for (const courseId of courseIds)
      await this.refreshCourseDurationEstimates(courseId, dbInstance);
  }

  private async computeProjection(
    courseId: UUIDType,
    db: DurationDb,
  ): Promise<DurationProjection | null> {
    const [course] = await this.courseDurationRepository.getCourseLocalization(courseId, db);
    if (!course) return null;

    const chapterRows = await this.courseDurationRepository.getChapterDurationRows(courseId, db);
    const lessonRows = (await this.courseDurationRepository.getLessonProjectionRows(
      courseId,
      db,
    )) as DurationLessonRow[];
    const embeddedResourceIds = [
      ...new Set(
        lessonRows.flatMap((lesson) =>
          Object.values(lesson.description ?? {}).flatMap((content) =>
            extractEmbeddedResourceIds(content),
          ),
        ),
      ),
    ];
    const resourceRows = embeddedResourceIds.length
      ? await this.courseDurationRepository.getResourceRowsByReferences(embeddedResourceIds, db)
      : [];
    const resourcesByReference = new Map<string, DurationResource>();
    for (const resource of resourceRows) {
      const value = {
        id: resource.id,
        resourceEntityId: resource.resourceEntityId,
        contentType: resource.contentType,
        metadata: resource.metadata,
      };
      resourcesByReference.set(resource.id, value);
      if (resource.resourceEntityId) resourcesByReference.set(resource.resourceEntityId, value);
    }

    const lessonProjections = new Map<UUIDType, DurationEstimatesByLanguage>();
    const chapterProjections = new Map<UUIDType, DurationEstimatesByLanguage>();
    const courseProjections = new Map<UUIDType, DurationEstimatesByLanguage>();
    const chapterTotals = new Map<UUIDType, Map<SupportedLanguages, number>>();
    const activeLanguages = [
      ...new Set([course.baseLanguage, ...course.availableLocales]),
    ] as SupportedLanguages[];
    for (const chapter of chapterRows) chapterTotals.set(chapter.id, new Map());

    for (const lesson of lessonRows) {
      const byLanguage = emptyLanguageEstimates(activeLanguages);
      for (const language of activeLanguages) {
        const description = getLocalizedDurationDescription(
          lesson.description,
          language,
          course.baseLanguage,
          course.availableLocales,
        );
        const seconds = calculateLessonDurationSeconds({
          descriptionHtml: description,
          quizQuestionCount: Number(lesson.questionCount) || 0,
          lessonType: lesson.type,
          resourcesByReference,
        });
        byLanguage[language] = { totalSeconds: seconds };
        const chapterTotal = chapterTotals.get(lesson.chapterId);
        chapterTotal?.set(language, (chapterTotal.get(language) ?? 0) + seconds);
      }
      lessonProjections.set(lesson.id, byLanguage);
    }

    for (const chapter of chapterRows) {
      const byLanguage = emptyLanguageEstimates(activeLanguages);
      const totals = chapterTotals.get(chapter.id);
      for (const language of activeLanguages)
        byLanguage[language] = { totalSeconds: totals?.get(language) ?? 0 };
      chapterProjections.set(chapter.id, byLanguage);
    }
    const courseProjection = emptyLanguageEstimates(activeLanguages);
    for (const language of activeLanguages)
      courseProjection[language] = {
        totalSeconds: [...chapterTotals.values()].reduce(
          (sum, totals) => sum + (totals.get(language) ?? 0),
          0,
        ),
      };
    courseProjections.set(courseId, courseProjection);
    return { lessons: lessonProjections, chapters: chapterProjections, courses: courseProjections };
  }

  private getEstimateSeconds(
    estimates: DurationEstimatesByLanguage | null,
    language: SupportedLanguages,
  ): number {
    return getEstimate(estimates, language).totalSeconds;
  }
}
