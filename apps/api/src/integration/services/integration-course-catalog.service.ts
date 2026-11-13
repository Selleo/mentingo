import { Injectable, NotFoundException } from "@nestjs/common";

import { CourseDurationService } from "src/courses/duration/course-duration.service";
import { FileService } from "src/file/file.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  INTEGRATION_COURSE_CATALOG_TRANSACTION,
  INTEGRATION_COURSE_THUMBNAIL_QUALITY,
} from "../integration.constants";
import { IntegrationCourseRepository } from "../repositories/integration-course.repository";
import { assertCanExportTenantCourses } from "../utils/integration-course-access.utils";

import type { IntegrationCoursesQuery } from "../integration-course.types";
import type { IntegrationKeyTenantContext } from "../integration.types";
import type {
  IntegrationCourseOutline,
  IntegrationCourseOutlineChapter,
  IntegrationCoursesResponse,
} from "../schemas/integration-course.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { Pagination } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

/** Lists the selected tenant's courses, and their outlines, for external catalogs such as the content marketplace. */
@Injectable()
export class IntegrationCourseCatalogService {
  constructor(
    private readonly integrationCourseRepository: IntegrationCourseRepository,
    private readonly fileService: FileService,
    private readonly courseDurationService: CourseDurationService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async listTenantCourses(
    query: IntegrationCoursesQuery,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<{ data: IntegrationCoursesResponse; pagination: Pagination }> {
    assertCanExportTenantCourses(actor, keyTenant);

    const { coursesPage, totalItems, durationByCourse } =
      await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        const coursesPage = await this.integrationCourseRepository.findCoursesPage(query);
        const totalItems = await this.integrationCourseRepository.countCourses(query);
        const durationByCourse = await this.courseDurationService.getCourseDurationDisplayMinutes(
          coursesPage.map((course) => course.id),
          query.language,
          transaction,
        );

        return { coursesPage, totalItems, durationByCourse };
      }, INTEGRATION_COURSE_CATALOG_TRANSACTION);

    const data = await Promise.all(
      coursesPage.map(async ({ thumbnailReference, category, ...course }) => ({
        ...course,
        thumbnailUrl: thumbnailReference
          ? await this.fileService.getFileUrl(thumbnailReference, {
              quality: INTEGRATION_COURSE_THUMBNAIL_QUALITY,
            })
          : null,
        metadata: {
          category: category || null,
          durationMinutes: Math.round(durationByCourse[course.id] ?? 0) || null,
        },
      })),
    );

    return {
      data,
      pagination: { totalItems, page: query.page, perPage: query.perPage },
    };
  }

  /** The course's chapters, lessons and learning outcomes in the given language, falling back to the base language. */
  async getCourseOutline(
    courseId: string,
    language: SupportedLanguages,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<IntegrationCourseOutline> {
    assertCanExportTenantCourses(actor, keyTenant);

    const { course, outlineRows } = await this.tenantDbRunnerService.transactionWithHandle(
      async () => ({
        course: await this.integrationCourseRepository.findCourseLearningOutcomes(
          courseId,
          language,
        ),
        outlineRows: await this.integrationCourseRepository.findCourseOutlineRows(
          courseId,
          language,
        ),
      }),
      INTEGRATION_COURSE_CATALOG_TRANSACTION,
    );

    if (!course) throw new NotFoundException("adminCourseView.toast.courseNotFound");

    return {
      id: course.id,
      learningOutcomes: course.learningOutcomes,
      chapters: this.groupLessonsByChapter(outlineRows),
    };
  }

  private groupLessonsByChapter(
    outlineRows: Awaited<ReturnType<IntegrationCourseRepository["findCourseOutlineRows"]>>,
  ) {
    const chaptersById = new Map<string, IntegrationCourseOutlineChapter>();

    for (const { chapterId, chapterTitle, lessonId, lessonTitle, lessonType } of outlineRows) {
      const chapter = chaptersById.get(chapterId) ?? {
        id: chapterId,
        title: chapterTitle,
        lessons: [],
      };

      if (lessonId && lessonType)
        chapter.lessons.push({ id: lessonId, title: lessonTitle, type: lessonType });

      chaptersById.set(chapterId, chapter);
    }

    return [...chaptersById.values()];
  }
}
