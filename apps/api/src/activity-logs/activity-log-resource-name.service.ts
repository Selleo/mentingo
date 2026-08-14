import { Inject, Injectable } from "@nestjs/common";
import {
  ACTIVITY_LOG_RESOURCE_TYPES,
  SCORM_PACKAGE_ENTITY_TYPE,
  type ActivityLogResourceType,
} from "@repo/shared";
import { eq, inArray, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  announcements,
  articleSections,
  articles,
  calendarEvents,
  categories,
  chapters,
  courses,
  groups,
  learningPaths,
  lessons,
  liveTrainings,
  news,
  questionsAndAnswers,
  scormPackages,
  users,
} from "src/storage/schema";

import type {
  ActivityLogResourceReference,
  NamedActivityLogResource,
} from "./activity-log-resource-name.types";

@Injectable()
export class ActivityLogResourceNameService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async resolveCurrentResourceNames(
    resources: ActivityLogResourceReference[],
  ): Promise<Map<string, string>> {
    const resourcesByType = this.groupUniqueResourceIdsByType(resources);

    const resolvedResources = await Promise.all(
      [...resourcesByType].map(async ([resourceType, ids]) => ({
        resourceType,
        resources: await this.fetchResourceNamesByType(resourceType, [...ids]),
      })),
    );

    return new Map(
      resolvedResources.flatMap(({ resourceType, resources: namedResources }) =>
        namedResources.flatMap(({ id, name }) =>
          name ? [[this.buildResourceLookupKey(resourceType, id), name] as const] : [],
        ),
      ),
    );
  }

  findResolvedResourceName(
    names: Map<string, string>,
    resourceType: string | null,
    resourceId: string | null,
  ): string | null {
    if (!resourceType || !resourceId) return null;

    return names.get(this.buildResourceLookupKey(resourceType, resourceId)) ?? null;
  }

  private buildResourceLookupKey(resourceType: string, resourceId: string) {
    return `${resourceType}:${resourceId}`;
  }

  private groupUniqueResourceIdsByType(resources: ActivityLogResourceReference[]) {
    const resourcesByType = new Map<ActivityLogResourceType, Set<UUIDType>>();

    for (const { resourceType, resourceId } of resources) {
      if (!resourceType || !resourceId) continue;

      const typedResource = resourceType as ActivityLogResourceType;
      const resourceIds = resourcesByType.get(typedResource) ?? new Set<UUIDType>();
      resourceIds.add(resourceId);
      resourcesByType.set(typedResource, resourceIds);
    }

    return resourcesByType;
  }

  private async fetchResourceNamesByType(
    resourceType: ActivityLogResourceType,
    ids: UUIDType[],
  ): Promise<NamedActivityLogResource[]> {
    switch (resourceType) {
      case ACTIVITY_LOG_RESOURCE_TYPES.USER:
        return this.db
          .select({
            id: users.id,
            name: sql<string>`TRIM(CONCAT_WS(' ', ${users.firstName}, ${users.lastName}))`,
          })
          .from(users)
          .where(inArray(users.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.COURSE:
        return this.db
          .select({
            id: courses.id,
            name: this.localizationService.getLocalizedSqlField(courses.title),
          })
          .from(courses)
          .where(inArray(courses.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER:
        return this.db
          .select({
            id: chapters.id,
            name: this.localizationService.getLocalizedSqlField(chapters.title),
          })
          .from(chapters)
          .innerJoin(courses, eq(courses.id, chapters.courseId))
          .where(inArray(chapters.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.LESSON:
        return this.db
          .select({
            id: lessons.id,
            name: this.localizationService.getLocalizedSqlField(lessons.title),
          })
          .from(lessons)
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .innerJoin(courses, eq(courses.id, chapters.courseId))
          .where(inArray(lessons.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT:
        return this.db
          .select({
            id: announcements.id,
            name: this.localizationService.getLocalizedSqlField(
              announcements.title,
              undefined,
              announcements,
            ),
          })
          .from(announcements)
          .where(inArray(announcements.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.GROUP:
        return this.db
          .select({
            id: groups.id,
            name: this.localizationService.getLocalizedSqlField(groups.name, undefined, groups),
          })
          .from(groups)
          .where(inArray(groups.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY:
        return this.db
          .select({
            id: categories.id,
            name: this.localizationService.getLocalizedSqlField(
              categories.title,
              undefined,
              categories,
            ),
          })
          .from(categories)
          .where(inArray(categories.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.QA:
        return this.db
          .select({
            id: questionsAndAnswers.id,
            name: this.localizationService.getLocalizedSqlField(
              questionsAndAnswers.title,
              undefined,
              questionsAndAnswers,
            ),
          })
          .from(questionsAndAnswers)
          .where(inArray(questionsAndAnswers.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.NEWS:
        return this.db
          .select({
            id: news.id,
            name: this.localizationService.getLocalizedSqlField(news.title, undefined, news),
          })
          .from(news)
          .where(inArray(news.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE:
        return this.db
          .select({
            id: articles.id,
            name: this.localizationService.getLocalizedSqlField(
              articles.title,
              undefined,
              articles,
            ),
          })
          .from(articles)
          .where(inArray(articles.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION:
        return this.db
          .select({
            id: articleSections.id,
            name: this.localizationService.getLocalizedSqlField(
              articleSections.title,
              undefined,
              articleSections,
            ),
          })
          .from(articleSections)
          .where(inArray(articleSections.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING:
        return this.db
          .select({
            id: liveTrainings.id,
            name: this.localizationService.getLocalizedSqlField(
              calendarEvents.title,
              undefined,
              calendarEvents,
            ),
          })
          .from(liveTrainings)
          .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
          .where(inArray(liveTrainings.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH:
        return this.db
          .select({
            id: learningPaths.id,
            name: this.localizationService.getLocalizedSqlField(
              learningPaths.title,
              undefined,
              learningPaths,
            ),
          })
          .from(learningPaths)
          .where(inArray(learningPaths.id, ids));
      case ACTIVITY_LOG_RESOURCE_TYPES.SCORM:
        return this.fetchScormResourceNames(ids);
      default:
        return [];
    }
  }

  private async fetchScormResourceNames(ids: UUIDType[]): Promise<NamedActivityLogResource[]> {
    const packages = await this.db
      .select({
        id: scormPackages.id,
        entityId: scormPackages.entityId,
        entityType: scormPackages.entityType,
      })
      .from(scormPackages)
      .where(inArray(scormPackages.id, ids));

    const courseIds = packages
      .filter(({ entityType }) => entityType === SCORM_PACKAGE_ENTITY_TYPE.COURSE)
      .map(({ entityId }) => entityId);

    const lessonIds = packages
      .filter(({ entityType }) => entityType === SCORM_PACKAGE_ENTITY_TYPE.LESSON)
      .map(({ entityId }) => entityId);

    const [courseNames, lessonNames] = await Promise.all([
      courseIds.length
        ? this.db
            .select({
              id: courses.id,
              name: this.localizationService.getLocalizedSqlField(courses.title),
            })
            .from(courses)
            .where(inArray(courses.id, courseIds))
        : [],
      lessonIds.length
        ? this.db
            .select({
              id: lessons.id,
              name: this.localizationService.getLocalizedSqlField(lessons.title),
            })
            .from(lessons)
            .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
            .innerJoin(courses, eq(courses.id, chapters.courseId))
            .where(inArray(lessons.id, lessonIds))
        : [],
    ]);

    const entityNames = new Map([...courseNames, ...lessonNames].map(({ id, name }) => [id, name]));

    return packages.map(({ id, entityId }) => ({ id, name: entityNames.get(entityId) ?? "" }));
  }
}
