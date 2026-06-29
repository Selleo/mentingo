import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { COURSE_ORIGIN_TYPES } from "@repo/shared";
import { eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { SearchIndexService } from "src/global-search/search-index.service";
import { DB } from "src/storage/db/db.providers";
import { courses, coursesSummaryStats } from "src/storage/schema";

import type {
  CourseDuplicationSourceCourse,
  CreateDraftDuplicateCourseInput,
} from "src/courses/course-duplication.types";

@Injectable()
export class CourseDuplicationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly searchIndexService: SearchIndexService,
  ) {}

  async getSourceCourse(
    sourceCourseId: UUIDType,
  ): Promise<CourseDuplicationSourceCourse | undefined> {
    const [sourceCourse] = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
        authorId: courses.authorId,
        categoryId: courses.categoryId,
        currency: courses.currency,
        courseType: courses.courseType,
        settings: courses.settings,
      })
      .from(courses)
      .where(eq(courses.id, sourceCourseId))
      .limit(1);

    return sourceCourse;
  }

  async createDraftDuplicateCourse(input: CreateDraftDuplicateCourseInput): Promise<UUIDType> {
    const { sourceCourse, title, authorId } = input;

    return this.db.transaction(async (trx) => {
      const [createdCourse] = await trx
        .insert(courses)
        .values({
          title,
          description: sourceCourse.description,
          baseLanguage: sourceCourse.baseLanguage,
          availableLocales: sourceCourse.availableLocales,
          status: "draft",
          priceInCents: 0,
          currency: sourceCourse.currency,
          courseType: sourceCourse.courseType,
          authorId,
          categoryId: sourceCourse.categoryId,
          stripeProductId: null,
          stripePriceId: null,
          originType: COURSE_ORIGIN_TYPES.REGULAR,
          sourceCourseId: null,
          sourceTenantId: null,
          settings: sourceCourse.settings,
        })
        .returning({ id: courses.id });

      if (!createdCourse) throw new NotFoundException("courseDuplication.error.createFailed");

      await trx.insert(coursesSummaryStats).values({ courseId: createdCourse.id, authorId });

      await this.searchIndexService.refreshCourse(createdCourse.id, trx);

      return createdCourse.id;
    });
  }
}
