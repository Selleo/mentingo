import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { UserService } from "src/user/user.service";

import { CourseSlugService } from "../authoring/course-slug.service";
import { CourseDurationService } from "../duration/course-duration.service";
import { CourseMediaUrlService } from "../media/course-media-url.service";
import { COURSE_ENROLLMENT_SCOPES, CourseSortFields } from "../schemas/courseQuery";

import { CourseCatalogRepository } from "./course-catalog.repository";

import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
  PublishedCourseLookupResponse,
} from "../schemas/course.schema";
import type { CourseEnrollmentScope, CoursesQuery } from "../schemas/courseQuery";
import type { SupportedLanguages } from "@repo/shared";
import type { AllCategoriesResponse } from "src/category/schemas/category.schema";
import type { DatabasePg, Pagination, UUIDType } from "src/common";

const TOP_COURSES_DEFAULTS = { limit: 5, days: 30 } as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CourseCatalogService {
  private readonly logger = new Logger(CourseCatalogService.name);

  constructor(
    private readonly courseCatalogRepository: CourseCatalogRepository,
    private readonly courseMediaUrlService: CourseMediaUrlService,
    private readonly courseSlugService: CourseSlugService,
    private readonly courseDurationService: CourseDurationService,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  /** Admin course list, scoped to the courses the user may manage. */
  async getAllCourses(query: CoursesQuery): Promise<{
    data: AllCoursesResponse;
    pagination: Pagination;
  }> {
    const {
      filters = {},
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      sort = CourseSortFields.title,
      currentUserId,
      currentUserPermissions = [],
      currentUser,
      language,
    } = query;

    const managedCoursesFilters = {
      filters,
      includeArchived: query.includeArchived,
      language,
      accessScope: { currentUser, currentUserId, currentUserPermissions },
    };

    const data = await this.courseCatalogRepository.findManagedCourses(managedCoursesFilters, {
      page,
      perPage,
      sort,
    });
    const trailerUrls = await this.courseMediaUrlService.getCourseTrailerUrls(
      data.map((item) => item.id),
    );

    const dataWithS3SignedUrls = await Promise.all(
      data.map(async (item) => {
        const trailerUrl = trailerUrls[item.id] ?? null;
        if (!item.thumbnailUrl) return { ...item, trailerUrl };

        try {
          const signedUrl = await this.courseMediaUrlService.getSignedCourseThumbnailUrl(
            item.thumbnailUrl,
          );
          const authorAvatarSignedUrl = await this.userService.getUsersProfilePictureUrl(
            item.authorAvatarUrl,
          );
          return {
            ...item,
            thumbnailUrl: signedUrl,
            trailerUrl,
            authorAvatarUrl: authorAvatarSignedUrl,
          };
        } catch (error) {
          this.logger.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
          return { ...item, trailerUrl };
        }
      }),
    );

    const totalItems =
      await this.courseCatalogRepository.countManagedCourses(managedCoursesFilters);

    return {
      data: dataWithS3SignedUrls,
      pagination: { totalItems, page, perPage },
    };
  }

  /** The learner's enrolled courses: unfinished first, then by progress and the chosen sort. */
  async getCoursesForUser(
    query: CoursesQuery,
    userId: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    const {
      sort = CourseSortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
      language,
    } = query;

    return this.courseCatalogRepository.runInTransaction(async (trx) => {
      const studentCoursesFilters = { studentId: userId, filters, language };

      const data = await this.courseCatalogRepository.findStudentCourses(
        studentCoursesFilters,
        { page, perPage, sort },
        trx,
      );
      const totalItems = await this.courseCatalogRepository.countStudentCourses(
        studentCoursesFilters,
        trx,
      );

      const courseIds = data.map((item) => item.id);
      const trailerUrls = await this.courseMediaUrlService.getCourseTrailerUrls(courseIds);

      const dataWithS3SignedUrls = await Promise.all(
        data.map(async (item) => {
          const trailerUrl = trailerUrls[item.id] ?? null;
          try {
            const signedUrl = item.thumbnailUrl
              ? await this.courseMediaUrlService.getSignedCourseThumbnailUrl(item.thumbnailUrl)
              : item.thumbnailUrl;

            const authorAvatarSignedUrl = await this.userService.getUsersProfilePictureUrl(
              item.authorAvatarUrl,
            );
            return {
              ...item,
              thumbnailUrl: signedUrl,
              trailerUrl,
              authorAvatarUrl: authorAvatarSignedUrl,
            };
          } catch (error) {
            this.logger.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
            return { ...item, trailerUrl };
          }
        }),
      );

      const slugsMap = await this.courseSlugService.getCoursesSlugs(language || "en", courseIds);

      return {
        data: dataWithS3SignedUrls.map((item) => ({
          ...item,
          slug: slugsMap.get(item.id) || item.id,
        })),
        pagination: { totalItems: totalItems || 0, page, perPage },
      };
    });
  }

  /** Published courses the user is not enrolled in yet. */
  async getAvailableCourses(
    query: CoursesQuery,
    currentUserId?: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    const {
      sort = CourseSortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      language,
    } = query;

    return this.courseCatalogRepository.runInTransaction(async (trx) => {
      const availableCoursesFilters = await this.buildAvailableCoursesFilters(
        query,
        currentUserId,
        trx,
      );

      const data = await this.courseCatalogRepository.findAvailableCourses(
        availableCoursesFilters,
        { page, perPage, sort },
        trx,
      );
      const totalItems = await this.courseCatalogRepository.countAvailableCourses(
        availableCoursesFilters,
        trx,
      );

      const trailerUrls = await this.courseMediaUrlService.getCourseTrailerUrls(
        data.map((item) => item.id),
      );

      const dataWithS3SignedUrls = await Promise.all(
        data.map(async (item) => {
          try {
            const { authorAvatarUrl, ...itemWithoutReferences } = item;

            const signedUrl = await this.courseMediaUrlService.getSignedCourseThumbnailUrl(
              item.thumbnailUrl,
            );
            const authorAvatarSignedUrl =
              await this.userService.getUsersProfilePictureUrl(authorAvatarUrl);

            return {
              ...itemWithoutReferences,
              thumbnailUrl: signedUrl,
              trailerUrl: trailerUrls[item.id] ?? null,
              authorAvatarUrl: authorAvatarSignedUrl,
            };
          } catch (error) {
            this.logger.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
            return item;
          }
        }),
      );

      const courseIds = dataWithS3SignedUrls.map((item) => item.id);
      const slugsMap = await this.courseSlugService.getCoursesSlugs(language || "en", courseIds);
      const durationEstimates = await this.courseDurationService.getCourseDurationDisplayMinutes(
        courseIds,
        language,
        trx,
      );

      return {
        data: dataWithS3SignedUrls.map((item) => ({
          ...item,
          slug: slugsMap.get(item.id) || item.id,
          estimatedDurationMinutes: durationEstimates[item.id] ?? 0,
        })),
        pagination: { totalItems: totalItems || 0, page, perPage },
      };
    });
  }

  async getAvailableCourseCategories(
    query: CoursesQuery,
    currentUserId?: UUIDType,
  ): Promise<{ data: AllCategoriesResponse; pagination: Pagination }> {
    const { perPage = DEFAULT_PAGE_SIZE, page = 1 } = query;

    return this.courseCatalogRepository.runInTransaction(async (trx) => {
      const availableCoursesFilters = await this.buildAvailableCoursesFilters(
        query,
        currentUserId,
        trx,
      );

      const data = await this.courseCatalogRepository.findAvailableCourseCategories(
        availableCoursesFilters,
        { page, perPage },
        trx,
      );
      const totalItems = await this.courseCatalogRepository.countAvailableCourseCategories(
        availableCoursesFilters,
        trx,
      );

      return {
        data,
        pagination: { totalItems, page, perPage },
      };
    });
  }

  /** Most enrolled published courses over the last `days`, excluding the user's own enrollments. */
  async getTopCourses(
    query: { limit?: number; days?: number; language: SupportedLanguages },
    currentUserId?: UUIDType,
  ): Promise<AllStudentCoursesResponse> {
    const {
      limit = TOP_COURSES_DEFAULTS.limit,
      days = TOP_COURSES_DEFAULTS.days,
      language,
    } = query;
    const enrolledSince = new Date(Date.now() - days * DAY_IN_MS).toISOString();

    return this.courseCatalogRepository.runInTransaction(async (trx) => {
      const availableCourseIds = await this.courseCatalogRepository.findAvailableCourseIds(
        currentUserId,
        {},
        trx,
      );

      const coursesRows = await this.courseCatalogRepository.findTopCourses(
        { language, enrolledSince, limit, availableCourseIds },
        trx,
      );

      const courseIds = coursesRows.map((course) => course.id);

      const trailerUrls = await this.courseMediaUrlService.getCourseTrailerUrls(courseIds);
      const slugsMap = await this.courseSlugService.getCoursesSlugs(language || "en", courseIds);
      const durationEstimates = await this.courseDurationService.getCourseDurationDisplayMinutes(
        courseIds,
        language,
        trx,
      );

      const coursesWithSignedUrls = await Promise.all(
        coursesRows.map(async (course) => {
          try {
            const { authorAvatarUrl: authorAvatarReference, ...itemWithoutReferences } = course;

            const thumbnailUrl = await this.courseMediaUrlService.getSignedCourseThumbnailUrl(
              course.thumbnailUrl,
            );
            const authorAvatarUrl =
              await this.userService.getUsersProfilePictureUrl(authorAvatarReference);

            return {
              ...itemWithoutReferences,
              thumbnailUrl,
              trailerUrl: trailerUrls[course.id] ?? null,
              authorAvatarUrl,
            };
          } catch {
            return course;
          }
        }),
      );

      return coursesWithSignedUrls.map((course) => ({
        ...course,
        slug: slugsMap.get(course.id) || course.id,
        estimatedDurationMinutes: durationEstimates[course.id] ?? 0,
      }));
    });
  }

  async getPublishedCourseLookup(query: {
    title?: string;
    page?: number;
    perPage?: number;
    language: SupportedLanguages;
  }): Promise<{ data: PublishedCourseLookupResponse; pagination: Pagination }> {
    const { title, page = 1, perPage = 20, language } = query;

    return this.courseCatalogRepository.runInTransaction(async (trx) => {
      const data = await this.courseCatalogRepository.findPublishedCourses(
        { title, language },
        { page, perPage },
        trx,
      );
      const totalItems = await this.courseCatalogRepository.countPublishedCourses(
        { title, language },
        trx,
      );

      return {
        data,
        pagination: { totalItems, page, perPage },
      };
    });
  }

  /** Published courses of one author, either the ones the viewer is enrolled in or can still join. */
  async getContentCreatorCourses({
    currentUserId,
    authorId,
    scope,
    excludeCourseId,
    title,
    description,
    language,
  }: {
    currentUserId: UUIDType;
    authorId: UUIDType;
    scope: CourseEnrollmentScope;
    excludeCourseId?: UUIDType;
    title?: string;
    description?: string;
    language: SupportedLanguages;
  }): Promise<AllCoursesForContentCreatorResponse> {
    const availableCourseIds =
      scope === COURSE_ENROLLMENT_SCOPES.AVAILABLE
        ? await this.courseCatalogRepository.findAvailableCourseIds(currentUserId, {
            authorId,
            excludeCourseId,
          })
        : [];

    if (scope === COURSE_ENROLLMENT_SCOPES.AVAILABLE && !availableCourseIds.length) return [];

    const contentCreatorCourses = await this.courseCatalogRepository.findContentCreatorCourses({
      currentUserId,
      authorId,
      scope,
      excludeCourseId,
      title,
      description,
      language,
      availableCourseIds,
    });

    const courseIds = contentCreatorCourses.map((course) => course.id);
    const slugsMap = await this.courseSlugService.getCoursesSlugs(language, courseIds);
    const durationEstimates = await this.courseDurationService.getCourseDurationDisplayMinutes(
      courseIds,
      language,
    );

    return Promise.all(
      contentCreatorCourses.map(async (course) => {
        const { authorAvatarUrl, ...courseWithoutReferences } = course;

        const authorAvatarSignedUrl =
          await this.userService.getUsersProfilePictureUrl(authorAvatarUrl);

        return {
          ...courseWithoutReferences,
          thumbnailUrl: course.thumbnailUrl
            ? await this.courseMediaUrlService.getSignedCourseThumbnailUrl(course.thumbnailUrl)
            : course.thumbnailUrl,
          authorAvatarUrl: authorAvatarSignedUrl,
          estimatedDurationMinutes: durationEstimates[course.id] ?? 0,
          slug: slugsMap.get(course.id) || course.id,
        };
      }),
    );
  }

  private async buildAvailableCoursesFilters(
    query: CoursesQuery,
    currentUserId: UUIDType | undefined,
    trx: DatabasePg,
  ) {
    const { filters = {}, language } = query;

    const availableCourseIds = await this.courseCatalogRepository.findAvailableCourseIds(
      currentUserId,
      { excludeCourseId: query.excludeCourseId },
      trx,
    );

    return { filters, language, currentUserId, availableCourseIds };
  }
}
