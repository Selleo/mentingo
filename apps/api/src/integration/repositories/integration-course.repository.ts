import { Inject, Injectable } from "@nestjs/common";
import { and, asc, countDistinct, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { categories, chapters, courses } from "src/storage/schema";

import type { IntegrationCoursesQuery } from "../integration-course.types";

/** Reads the courses of the tenant selected by the integration key, for catalogs such as the content marketplace. */
@Injectable()
export class IntegrationCourseRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findCoursesPage(query: IntegrationCoursesQuery) {
    const localizedTitle = this.localizationService.getLocalizedSqlField(
      courses.title,
      query.language,
    );

    const coursesPage = this.db
      .select({
        id: courses.id,
        title: localizedTitle,
        description: this.localizationService.getLocalizedSqlField(
          courses.description,
          query.language,
        ),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          query.language,
          categories,
        ),
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
        thumbnailReference: courses.thumbnailS3Key,
        status: courses.status,
        originType: courses.originType,
        chapterCount: courses.chapterCount,
        lessonCount: sql<number>`COALESCE(SUM(${chapters.lessonCount}), 0)::INTEGER`,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .leftJoin(categories, eq(categories.id, courses.categoryId))
      .leftJoin(chapters, eq(chapters.courseId, courses.id))
      .where(this.buildCourseConditions(query))
      .groupBy(courses.id, categories.id)
      .orderBy(asc(localizedTitle), asc(courses.id))
      .$dynamic();

    return addPagination(coursesPage, query.page, query.perPage);
  }

  async countCourses(query: IntegrationCoursesQuery) {
    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(courses.id) })
      .from(courses)
      .where(this.buildCourseConditions(query));

    return totalItems;
  }

  private buildCourseConditions(query: IntegrationCoursesQuery) {
    return and(
      eq(courses.isArchived, false),
      query.keyword
        ? this.localizationService.getLocalizedFieldSearchCondition(
            courses.title,
            `%${query.keyword}%`,
          )
        : undefined,
    );
  }
}
