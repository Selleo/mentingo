import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import {
  and,
  between,
  count,
  countDistinct,
  eq,
  ilike,
  inArray,
  isNotNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { isEmpty } from "lodash";

import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg } from "src/common";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { EnvService } from "src/env/services/env.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { StripeService } from "src/stripe/stripe.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";
import { hasDataToUpdate } from "src/utils/hasDataToUpdate";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { getSortOptions } from "../common/helpers/getSortOptions";
import {
  aiMentorStudentLessonProgress,
  categories,
  chapters,
  courses,
  coursesSummaryStats,
  groups,
  groupUsers,
  lessons,
  questions,
  quizAttempts,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  studentQuestionAnswers,
  users,
} from "../storage/schema";

import {
  COURSE_ENROLLMENT_SCOPES,
  CourseSortFields,
  EnrolledStudentSortFields,
  CourseStudentProgressionSortFields,
  CourseStudentQuizResultsSortFields,
  CourseStudentAiMentorResultsSortFields,
} from "./schemas/courseQuery";

import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
  CourseAverageQuizScorePerQuiz,
  CourseAverageQuizScoresResponse,
  CourseStatisticsResponse,
  CourseStatusDistribution,
} from "./schemas/course.schema";
import type {
  CourseStudentProgressionSortField,
  CourseStudentProgressionQuery,
  CourseEnrollmentScope,
  CoursesFilterSchema,
  CourseSortField,
  CoursesQuery,
  EnrolledStudentFilterSchema,
  CourseStudentQuizResultsQuery,
  CourseStudentQuizResultsSortField,
  CourseStudentAiMentorResultsQuery,
  CourseStudentAiMentorResultsSortField,
} from "./schemas/courseQuery";
import type { CreateCourseBody } from "./schemas/createCourse.schema";
import type { CreateCoursesEnrollment } from "./schemas/createCoursesEnrollment";
import type { EnrolledStudent, StudentCourseSelect } from "./schemas/enrolledStudent.schema";
import type { CommonShowCourse } from "./schemas/showCourseCommon.schema";
import type { UpdateCourseBody } from "./schemas/updateCourse.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { BaseResponse, Pagination, UUIDType } from "src/common";
import type {
  AdminLessonWithContentSchema,
  LessonForChapterSchema,
} from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";
import type { UserRole } from "src/user/schemas/userRoles";
import type { ProgressStatus } from "src/utils/types/progress.type";
import type Stripe from "stripe";

@Injectable()
export class CourseService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly fileService: FileService,
    private readonly lessonRepository: LessonRepository,
    private readonly statisticsRepository: StatisticsRepository,
    private readonly userService: UserService,
    private readonly settingsService: SettingsService,
    private readonly stripeService: StripeService,
    private readonly envService: EnvService,
    private readonly eventBus: EventBus,
  ) {}

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
      currentUserRole,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const conditions = this.getFiltersConditions(filters, false);

    if (currentUserRole === USER_ROLES.CONTENT_CREATOR && currentUserId) {
      conditions.push(eq(courses.authorId, currentUserId));
    }

    const queryDB = this.db
      .select({
        id: courses.id,
        title: courses.title,
        description: sql<string>`${courses.description}`,
        thumbnailUrl: courses.thumbnailS3Key,
        author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        authorAvatarUrl: sql<string>`${users.avatarReference}`,
        category: sql<string>`${categories.title}`,
        enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
        courseChapterCount: courses.chapterCount,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        status: courses.status,
        createdAt: courses.createdAt,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
      .where(and(...conditions))
      .groupBy(
        courses.id,
        courses.title,
        courses.description,
        courses.thumbnailS3Key,
        users.firstName,
        users.lastName,
        users.avatarReference,
        categories.title,
        courses.priceInCents,
        courses.currency,
        courses.status,
        coursesSummaryStats.freePurchasedCount,
        coursesSummaryStats.paidPurchasedCount,
        courses.createdAt,
      )
      .orderBy(sortOrder(this.getColumnToSortBy(sortedField as CourseSortField)));

    const dynamicQuery = queryDB.$dynamic();
    const paginatedQuery = addPagination(dynamicQuery, page, perPage);
    const data = await paginatedQuery;

    const dataWithS3SignedUrls = await Promise.all(
      data.map(async (item) => {
        if (!item.thumbnailUrl) return item;

        try {
          const signedUrl = await this.fileService.getFileUrl(item.thumbnailUrl);
          const authorAvatarSignedUrl = await this.userService.getUsersProfilePictureUrl(
            item.authorAvatarUrl,
          );
          return { ...item, thumbnailUrl: signedUrl, authorAvatarUrl: authorAvatarSignedUrl };
        } catch (error) {
          console.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
          return item;
        }
      }),
    );

    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(courses.id) })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
      .where(and(...conditions));

    return {
      data: dataWithS3SignedUrls,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async getCoursesForUser(
    query: CoursesQuery,
    userId: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    const {
      sort = CourseSortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db.transaction(async (trx) => {
      const conditions = [
        eq(studentCourses.studentId, userId),
        or(eq(courses.status, "published"), eq(courses.status, "private")),
      ];
      conditions.push(...this.getFiltersConditions(filters, false));

      const queryDB = trx
        .select(this.getSelectField())
        .from(studentCourses)
        .innerJoin(courses, eq(studentCourses.courseId, courses.id))
        .innerJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
        .where(and(...conditions))
        .groupBy(
          courses.id,
          courses.title,
          courses.thumbnailS3Key,
          courses.description,
          courses.authorId,
          users.firstName,
          users.lastName,
          users.email,
          users.avatarReference,
          studentCourses.studentId,
          categories.title,
          coursesSummaryStats.freePurchasedCount,
          coursesSummaryStats.paidPurchasedCount,
          studentCourses.finishedChapterCount,
        )
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as CourseSortField)));

      const dynamicQuery = queryDB.$dynamic();
      const paginatedQuery = addPagination(dynamicQuery, page, perPage);
      const data = await paginatedQuery;
      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(courses.id) })
        .from(studentCourses)
        .innerJoin(courses, eq(studentCourses.courseId, courses.id))
        .innerJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .where(and(...conditions));

      const dataWithS3SignedUrls = await Promise.all(
        data.map(async (item) => {
          if (!item.thumbnailUrl) return item;

          try {
            const signedUrl = await this.fileService.getFileUrl(item.thumbnailUrl);
            const authorAvatarSignedUrl = await this.userService.getUsersProfilePictureUrl(
              item.authorAvatarUrl,
            );
            return { ...item, thumbnailUrl: signedUrl, authorAvatarUrl: authorAvatarSignedUrl };
          } catch (error) {
            console.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
            return item;
          }
        }),
      );

      return {
        data: dataWithS3SignedUrls,
        pagination: {
          totalItems: totalItems || 0,
          page,
          perPage,
        },
      };
    });
  }

  async getStudentsWithEnrollmentDate(
    courseId: UUIDType,
    filters: EnrolledStudentFilterSchema,
  ): Promise<BaseResponse<EnrolledStudent[]>> {
    const { keyword, sort = EnrolledStudentSortFields.enrolledAt } = filters;

    const { sortOrder } = getSortOptions(sort);

    const conditions = [];

    if (keyword) {
      const searchKeyword = keyword.toLowerCase();

      conditions.push(
        or(
          ilike(users.firstName, `%${searchKeyword}%`),
          ilike(users.lastName, `%${searchKeyword}%`),
          ilike(users.email, `%${searchKeyword}%`),
        ),
      );
    }

    if (filters.groupId) {
      conditions.push(eq(groupUsers.groupId, filters.groupId));
    }

    const data = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        id: users.id,
        enrolledAt: studentCourses.createdAt,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(users)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions, eq(users.role, USER_ROLES.STUDENT), eq(users.archived, false)))
      .orderBy(sortOrder(studentCourses.createdAt));

    return {
      data: data ?? [],
    };
  }

  async getAvailableCourses(
    query: CoursesQuery,
    currentUserId?: UUIDType,
  ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
    const {
      sort = CourseSortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
    } = query;
    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db.transaction(async (trx) => {
      const availableCourseIds = await this.getAvailableCourseIds(
        trx,
        currentUserId,
        undefined,
        query.excludeCourseId,
      );

      const conditions = [eq(courses.status, "published")];
      conditions.push(...this.getFiltersConditions(filters));

      if (availableCourseIds.length > 0) {
        conditions.push(inArray(courses.id, availableCourseIds));
      }

      const queryDB = trx
        .select({
          id: courses.id,
          description: sql<string>`${courses.description}`,
          title: courses.title,
          thumbnailUrl: sql<string>`${courses.thumbnailS3Key}`,
          authorId: sql<string>`${courses.authorId}`,
          author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
          authorEmail: sql<string>`${users.email}`,
          authorAvatarUrl: sql<string>`${users.avatarReference}`,
          category: sql<string>`${categories.title}`,
          enrolled: sql<boolean>`FALSE`,
          enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
          courseChapterCount: courses.chapterCount,
          completedChapterCount: sql<number>`0`,
          priceInCents: courses.priceInCents,
          currency: courses.currency,
          hasFreeChapters: sql<boolean>`
            EXISTS (
              SELECT 1
              FROM ${chapters}
              WHERE ${chapters.courseId} = ${courses.id}
                AND ${chapters.isFreemium} = TRUE
            )
          `,
        })
        .from(courses)
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
        .where(and(...conditions))
        .groupBy(
          courses.id,
          courses.title,
          courses.thumbnailS3Key,
          courses.description,
          courses.authorId,
          users.firstName,
          users.lastName,
          users.email,
          users.avatarReference,
          categories.title,
          coursesSummaryStats.freePurchasedCount,
          coursesSummaryStats.paidPurchasedCount,
        )
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as CourseSortField)));

      const dynamicQuery = queryDB.$dynamic();
      const paginatedQuery = addPagination(dynamicQuery, page, perPage);
      const data = await paginatedQuery;
      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(courses.id) })
        .from(courses)
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .where(and(...conditions));

      const dataWithS3SignedUrls = await Promise.all(
        data.map(async (item) => {
          try {
            const { authorAvatarUrl, ...itemWithoutReferences } = item;

            const signedUrl = await this.fileService.getFileUrl(item.thumbnailUrl);
            const authorAvatarSignedUrl =
              await this.userService.getUsersProfilePictureUrl(authorAvatarUrl);

            return {
              ...itemWithoutReferences,
              thumbnailUrl: signedUrl,
              authorAvatarUrl: authorAvatarSignedUrl,
            };
          } catch (error) {
            console.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
            return item;
          }
        }),
      );

      return {
        data: dataWithS3SignedUrls,
        pagination: {
          totalItems: totalItems || 0,
          page,
          perPage,
        },
      };
    });
  }

  async getCourse(id: UUIDType, userId: UUIDType): Promise<CommonShowCourse> {
    //TODO: to remove
    const testDeployment = "test";

    testDeployment;

    const [course] = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        thumbnailS3Key: sql<string>`${courses.thumbnailS3Key}`,
        category: sql<string>`${categories.title}`,
        description: sql<string>`${courses.description}`,
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`COALESCE(${studentCourses.finishedChapterCount}, 0)`,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
        status: courses.status,
        isScorm: courses.isScorm,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        hasCertificate: courses.hasCertificate,
        hasFreeChapter: sql<boolean>`
          EXISTS (
            SELECT 1
            FROM ${chapters}
            WHERE ${chapters.courseId} = ${courses.id}
              AND ${chapters.isFreemium} = TRUE
          )`,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(courses.id, id));

    const isEnrolled = !!course.enrolled;
    const NON_PUBLIC_STATUSES = ["draft", "private"];

    if (!course) throw new NotFoundException("Course not found");
    if (userId !== course.authorId && NON_PUBLIC_STATUSES.includes(course.status) && !isEnrolled)
      throw new ForbiddenException("You have no access to this course");

    const courseChapterList = await this.db
      .select({
        id: chapters.id,
        title: chapters.title,
        isSubmitted: sql<boolean>`
          EXISTS (
            SELECT 1
            FROM ${studentChapterProgress}
            WHERE ${studentChapterProgress.chapterId} = ${chapters.id}
              AND ${studentChapterProgress.courseId} = ${course.id}
              AND ${studentChapterProgress.studentId} = ${userId}
              AND ${studentChapterProgress.completedAt} IS NOT NULL
          )::BOOLEAN`,
        lessonCount: chapters.lessonCount,
        quizCount: sql<number>`
          (SELECT COUNT(*)
          FROM ${lessons}
          WHERE ${lessons.chapterId} = ${chapters.id}
            AND ${lessons.type} = ${LESSON_TYPES.QUIZ})::INTEGER`,
        completedLessonCount: sql<number>`COALESCE(${studentChapterProgress.completedLessonCount}, 0)`,
        chapterProgress: sql<ProgressStatus>`
          CASE
            WHEN ${studentChapterProgress.completedAt} IS NOT NULL THEN ${PROGRESS_STATUSES.COMPLETED}
            WHEN ${studentChapterProgress.completedLessonCount} > 0 OR EXISTS (
              SELECT 1
              FROM ${studentLessonProgress}
              WHERE ${studentLessonProgress.chapterId} = ${chapters.id}
                AND ${studentLessonProgress.studentId} = ${userId}
                AND ${studentLessonProgress.isStarted} = TRUE
            ) THEN ${PROGRESS_STATUSES.IN_PROGRESS}
            ELSE ${PROGRESS_STATUSES.NOT_STARTED}
          END
        `,
        isFreemium: chapters.isFreemium,
        displayOrder: sql<number>`${chapters.displayOrder}`,
        lessons: sql<LessonForChapterSchema>`
          COALESCE(
            (
              SELECT json_agg(lesson_data)
              FROM (
                SELECT
                  ${lessons.id} AS id,
                  ${lessons.title} AS title,
                  ${lessons.type} AS type,
                  ${lessons.displayOrder} AS "displayOrder",
                  ${lessons.isExternal} AS "isExternal",
                  CASE
                    WHEN (${chapters.isFreemium} = FALSE AND ${isEnrolled} = FALSE) THEN ${PROGRESS_STATUSES.BLOCKED}
                    WHEN ${studentLessonProgress.completedAt} IS NOT NULL AND (${studentLessonProgress.isQuizPassed} IS TRUE OR ${studentLessonProgress.isQuizPassed} IS NULL) THEN ${PROGRESS_STATUSES.COMPLETED}
                    WHEN ${studentLessonProgress.isStarted} THEN  ${PROGRESS_STATUSES.IN_PROGRESS}
                    ELSE  ${PROGRESS_STATUSES.NOT_STARTED}
                  END AS status,
                  CASE
                    WHEN ${lessons.type} = ${LESSON_TYPES.QUIZ} THEN COUNT(${questions.id})
                    ELSE NULL
                  END AS "quizQuestionCount"
                FROM ${lessons}
                LEFT JOIN ${studentLessonProgress} ON ${lessons.id} = ${studentLessonProgress.lessonId}
                  AND ${studentLessonProgress.studentId} = ${userId}
                LEFT JOIN ${questions} ON ${lessons.id} = ${questions.lessonId}
                WHERE ${lessons.chapterId} = ${chapters.id}
                GROUP BY
                  ${lessons.id},
                  ${lessons.type},
                  ${lessons.displayOrder},
                  ${lessons.title},
                  ${studentLessonProgress.completedAt},
                  ${studentLessonProgress.completedQuestionCount},
                  ${studentLessonProgress.isStarted},
                  ${chapters.isFreemium},
                  ${studentLessonProgress.isQuizPassed}
                ORDER BY ${lessons.displayOrder}
              ) AS lesson_data
            ),
            '[]'::json
          )
        `,
      })
      .from(chapters)
      .leftJoin(
        studentChapterProgress,
        and(
          eq(studentChapterProgress.chapterId, chapters.id),
          eq(studentChapterProgress.studentId, userId),
        ),
      )
      .where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);

    const thumbnailUrl = await this.fileService.getFileUrl(course.thumbnailS3Key);

    return {
      ...course,
      thumbnailUrl,
      chapters: courseChapterList,
    };
  }

  async getBetaCourseById(id: UUIDType, currentUserId: UUIDType, currentUserRole: UserRole) {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        thumbnailS3Key: sql<string>`COALESCE(${courses.thumbnailS3Key}, '')`,
        category: categories.title,
        categoryId: categories.id,
        description: sql<string>`${courses.description}`,
        courseChapterCount: courses.chapterCount,
        status: courses.status,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        hasCertificate: courses.hasCertificate,
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

    if (currentUserRole !== USER_ROLES.ADMIN && course.authorId !== currentUserId) {
      throw new ForbiddenException("You do not have permission to edit this course");
    }

    const courseChapterList = await this.db
      .select({
        id: chapters.id,
        title: chapters.title,
        displayOrder: sql<number>`${chapters.displayOrder}`,
        lessonCount: chapters.lessonCount,
        updatedAt: chapters.updatedAt,
        isFree: chapters.isFreemium,
        lessons: sql<LessonForChapterSchema>`
          COALESCE(
            (
              SELECT array_agg(${lessons.id} ORDER BY ${lessons.displayOrder})
              FROM ${lessons}
              WHERE ${lessons.chapterId} = ${chapters.id}
            ),
            '{}'
          )
        `,
      })
      .from(chapters)
      .where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);

    const thumbnailS3SingedUrl = course.thumbnailS3Key
      ? await this.fileService.getFileUrl(course.thumbnailS3Key)
      : null;

    const updatedCourseLessonList = await Promise.all(
      courseChapterList?.map(async (chapter) => {
        const lessons: AdminLessonWithContentSchema[] =
          await this.adminChapterRepository.getBetaChapterLessons(chapter.id);

        const lessonsWithSignedUrls = await this.addS3SignedUrlsToLessonsAndQuestions(lessons);

        return {
          ...chapter,
          lessons: lessonsWithSignedUrls,
        };
      }),
    );

    return {
      ...course,
      thumbnailS3SingedUrl,
      chapters: updatedCourseLessonList ?? [],
    };
  }

  async getContentCreatorCourses({
    currentUserId,
    authorId,
    scope,
    excludeCourseId,
    title,
    description,
    searchQuery,
  }: {
    currentUserId: UUIDType;
    authorId: UUIDType;
    scope: CourseEnrollmentScope;
    excludeCourseId?: UUIDType;
    title?: string;
    description?: string;
    searchQuery?: string;
  }): Promise<AllCoursesForContentCreatorResponse> {
    const conditions = [eq(courses.status, "published"), eq(courses.authorId, authorId)];

    if (scope === COURSE_ENROLLMENT_SCOPES.ENROLLED) {
      conditions.push(eq(studentCourses.studentId, currentUserId));
    }

    if (scope === COURSE_ENROLLMENT_SCOPES.AVAILABLE) {
      const availableCourseIds = await this.getAvailableCourseIds(
        this.db,
        currentUserId,
        authorId,
        excludeCourseId,
      );

      if (!availableCourseIds.length) return [];

      conditions.push(inArray(courses.id, availableCourseIds));
    }

    if (title) {
      conditions.push(ilike(courses.title, `%${title}%`));
    }

    if (description) {
      conditions.push(ilike(courses.description, `%${description}%`));
    }

    if (searchQuery) {
      const searchCondition = or(
        ilike(courses.title, `%${searchQuery}%`),
        ilike(courses.description, `%${searchQuery}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const contentCreatorCourses = await this.db
      .select({
        id: courses.id,
        description: sql<string>`${courses.description}`,
        title: courses.title,
        thumbnailUrl: courses.thumbnailS3Key,
        authorId: sql<string>`${courses.authorId}`,
        author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        authorEmail: sql<string>`${users.email}`,
        authorAvatarUrl: sql<string>`${users.avatarReference}`,
        category: sql<string>`${categories.title}`,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN true ELSE false END`,
        enrolledParticipantCount: sql<number>`0`,
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`0`,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasFreeChapters: sql<boolean>`
        EXISTS (
          SELECT 1
          FROM ${chapters}
          WHERE ${chapters.courseId} = ${courses.id}
            AND ${chapters.isFreemium} = true
        )`,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, courses.id), eq(studentCourses.studentId, currentUserId)),
      )
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .where(and(...conditions))
      .groupBy(
        courses.id,
        courses.title,
        courses.thumbnailS3Key,
        courses.description,
        courses.authorId,
        users.firstName,
        users.lastName,
        users.email,
        users.avatarReference,
        studentCourses.studentId,
        categories.title,
      )
      .orderBy(
        sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NULL THEN TRUE ELSE FALSE END`,
        courses.title,
      );

    return await Promise.all(
      contentCreatorCourses.map(async (course) => {
        const { authorAvatarUrl, ...courseWithoutReferences } = course;

        const authorAvatarSignedUrl =
          await this.userService.getUsersProfilePictureUrl(authorAvatarUrl);

        return {
          ...courseWithoutReferences,
          thumbnailUrl: course.thumbnailUrl
            ? await this.fileService.getFileUrl(course.thumbnailUrl)
            : course.thumbnailUrl,
          authorAvatarUrl: authorAvatarSignedUrl,
        };
      }),
    );
  }

  async updateHasCertificate(courseId: UUIDType, hasCertificate: boolean) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const [updatedCourse] = await this.db
      .update(courses)
      .set({ hasCertificate })
      .where(eq(courses.id, courseId))
      .returning();

    if (!updatedCourse) {
      throw new ConflictException("Failed to update course");
    }

    return updatedCourse;
  }

  async createCourse(
    createCourseBody: CreateCourseBody,
    authorId: UUIDType,
    isPlaywrightTest: boolean,
  ) {
    return this.db.transaction(async (trx) => {
      const [category] = await trx
        .select()
        .from(categories)
        .where(eq(categories.id, createCourseBody.categoryId));

      const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

      if (!category) {
        throw new NotFoundException("Category not found");
      }
      const globalSettings = await this.settingsService.getGlobalSettings();

      const finalCurrency = globalSettings.defaultCourseCurrency || "usd";

      let productId: string | null = null;
      let priceId: string | null = null;

      if (!isPlaywrightTest && isStripeConfigured) {
        const stripeResult = await this.stripeService.createProduct({
          name: createCourseBody.title,
          description: createCourseBody?.description ?? "",
          currency: finalCurrency,
          amountInCents: createCourseBody?.priceInCents ?? 0,
        });

        productId = stripeResult.productId;
        priceId = stripeResult.priceId;

        if (!productId || !priceId) {
          throw new InternalServerErrorException("Failed to create product");
        }
      }

      const [newCourse] = await trx
        .insert(courses)
        .values({
          title: createCourseBody.title,
          description: createCourseBody.description,
          thumbnailS3Key: createCourseBody.thumbnailS3Key,
          status: createCourseBody.status,
          priceInCents: createCourseBody.priceInCents,
          currency: finalCurrency,
          isScorm: createCourseBody.isScorm,
          authorId,
          categoryId: createCourseBody.categoryId,
          stripeProductId: productId,
          stripePriceId: priceId,
        })
        .returning();

      if (!newCourse) {
        throw new ConflictException("Failed to create course");
      }

      await trx.insert(coursesSummaryStats).values({ courseId: newCourse.id, authorId });

      return newCourse;
    });
  }

  async updateCourse(
    id: UUIDType,
    updateCourseBody: UpdateCourseBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
    isPlaywrightTest: boolean,
    image?: Express.Multer.File,
  ) {
    return this.db.transaction(async (trx) => {
      const [existingCourse] = await trx.select().from(courses).where(eq(courses.id, id));

      const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

      if (!existingCourse) {
        throw new NotFoundException("Course not found");
      }

      if (existingCourse.authorId !== currentUserId && currentUserRole !== USER_ROLES.ADMIN) {
        throw new ForbiddenException("You don't have permission to update course");
      }

      if (updateCourseBody.categoryId) {
        const [category] = await trx
          .select()
          .from(categories)
          .where(eq(categories.id, updateCourseBody.categoryId));

        if (!category) {
          throw new NotFoundException("Category not found");
        }
      }

      // TODO: to remove and start use file service
      let imageKey = undefined;
      if (image) {
        try {
          const fileExtension = image.originalname.split(".").pop();
          const resource = `courses/${crypto.randomUUID()}.${fileExtension}`;
          imageKey = await this.fileService.uploadFile(image, resource);
        } catch (error) {
          throw new ConflictException("Failed to upload course image");
        }
      }

      const { priceInCents, currency, ...rest } = updateCourseBody;

      const updateData = {
        ...rest,
        ...(isStripeConfigured ? { priceInCents, currency } : {}),
        ...(imageKey && { imageUrl: imageKey.fileUrl }),
      };

      const [updatedCourse] = await trx
        .update(courses)
        .set(updateData)
        .where(eq(courses.id, id))
        .returning();

      if (!updatedCourse) {
        throw new ConflictException("Failed to update course");
      }

      if (!isPlaywrightTest && isStripeConfigured) {
        // --- create stripe product if it doesn't exist yet ---
        if (!updatedCourse.stripeProductId) {
          const { productId, priceId } = await this.stripeService.createProduct({
            name: updatedCourse.title,
            description: updatedCourse.description ?? "",
            amountInCents: updatedCourse.priceInCents ?? 0,
            currency: updatedCourse.currency ?? "usd",
          });

          await trx
            .update(courses)
            .set({
              stripeProductId: productId,
              stripePriceId: priceId,
            })
            .where(eq(courses.id, id));
        } else {
          // --- stripe product update ---
          const productUpdatePayload = {
            ...(updateCourseBody.title && { name: updateCourseBody.title }),
            ...(updateCourseBody.description && { description: updateCourseBody.description }),
          };

          if (hasDataToUpdate(productUpdatePayload)) {
            await this.stripeService.updateProduct(
              updatedCourse.stripeProductId,
              productUpdatePayload,
            );
          }

          // --- stripe price update ---
          const hasPriceUpdate =
            updateCourseBody.priceInCents !== undefined || updateCourseBody.currency !== undefined;

          if (updatedCourse.stripePriceId && hasPriceUpdate) {
            const pricePayload: Stripe.PriceCreateParams = {
              product: updatedCourse.stripeProductId,
              currency: updateCourseBody.currency ?? "usd",
              ...(updateCourseBody.priceInCents !== undefined && {
                unit_amount: updateCourseBody.priceInCents,
              }),
            };

            const newStripePrice = await this.stripeService.createPrice(pricePayload);

            if (newStripePrice.id) {
              await this.stripeService.updatePrice(updatedCourse.stripePriceId, { active: false });

              await trx
                .update(courses)
                .set({ stripePriceId: newStripePrice.id })
                .where(eq(courses.id, id));
            }
          }
        }
      }

      return updatedCourse;
    });
  }

  async enrollCourse(id: UUIDType, studentId: UUIDType, testKey?: string, paymentId?: string) {
    const [course] = await this.db
      .select({
        id: courses.id,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
        price: courses.priceInCents,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, studentId)),
      )
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

    if (course.enrolled) throw new ConflictException("Course is already enrolled");

    this.db.transaction(async (trx) => {
      await this.createStudentCourse(id, studentId);
      await this.createCourseDependencies(id, studentId, paymentId, trx);
    });
  }

  async enrollCourses(courseId: UUIDType, body: CreateCoursesEnrollment) {
    const { studentIds } = body;

    const courseExists = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!courseExists.length) throw new NotFoundException(`Course ${courseId} not found`);
    if (!studentIds.length) throw new BadRequestException("Student ids not found");

    const existingStudentsEnrollments = await this.db
      .select({
        studentId: studentCourses.studentId,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, studentIds)),
      );

    if (existingStudentsEnrollments.length > 0) {
      const existingStudentsEnrollmentsIds = existingStudentsEnrollments.map(
        ({ studentId }) => studentId,
      );

      throw new ConflictException(
        `Students ${existingStudentsEnrollmentsIds.join(
          ", ",
        )} are already enrolled in course ${courseId}`,
      );
    }

    await this.db.transaction(async (trx) => {
      const studentCoursesValues = studentIds.map((studentId) => {
        return {
          studentId,
          courseId,
        };
      });

      await trx.insert(studentCourses).values(studentCoursesValues);

      this.eventBus.publish(new UsersAssignedToCourseEvent({ studentIds, courseId }));

      await Promise.all(
        studentIds.map(async (studentId) => {
          await this.createCourseDependencies(courseId, studentId, null, trx);
        }),
      );
    });
  }

  async createStudentCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
  ): Promise<StudentCourseSelect> {
    const [enrolledCourse] = await this.db
      .insert(studentCourses)
      .values({ studentId, courseId, paymentId })
      .returning();

    if (!enrolledCourse) throw new ConflictException("Course not enrolled");

    return enrolledCourse;
  }

  async createCourseDependencies(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    trx: PostgresJsDatabase<typeof schema>,
  ) {
    const courseChapterList = await trx
      .select({
        id: chapters.id,
        itemCount: chapters.lessonCount,
      })
      .from(chapters)
      .leftJoin(lessons, eq(lessons.chapterId, chapters.id))
      .where(eq(chapters.courseId, courseId))
      .groupBy(chapters.id);

    const existingLessonProgress = await this.lessonRepository.getLessonsProgressByCourseId(
      courseId,
      studentId,
      trx,
    );

    await this.createStatisicRecordForCourse(
      courseId,
      paymentId,
      isEmpty(existingLessonProgress),
      trx,
    );

    if (courseChapterList.length > 0) {
      await trx.insert(studentChapterProgress).values(
        courseChapterList.map((chapter) => ({
          studentId,
          chapterId: chapter.id,
          courseId,
          completedLessonItemCount: 0,
        })),
      );

      await Promise.all(
        courseChapterList.map(async (chapter) => {
          const chapterLessons = await trx
            .select({ id: lessons.id, type: lessons.type })
            .from(lessons)
            .where(eq(lessons.chapterId, chapter.id));

          await trx.insert(studentLessonProgress).values(
            chapterLessons.map((lesson) => ({
              studentId,
              lessonId: lesson.id,
              chapterId: chapter.id,
              completedQuestionCount: 0,
              quizScore: lesson.type === LESSON_TYPES.QUIZ ? 0 : null,
              completedAt: null,
            })),
          );
        }),
      );
    }
  }

  async deleteCourse(id: UUIDType, currentUserRole: UserRole) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, id));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (currentUserRole !== USER_ROLES.ADMIN && currentUserRole !== USER_ROLES.CONTENT_CREATOR) {
      throw new ForbiddenException("You don't have permission to delete this course");
    }

    if (course.status === "published") {
      throw new ForbiddenException("You can't delete a published course");
    }

    return this.db.transaction(async (trx) => {
      await trx.delete(quizAttempts).where(eq(quizAttempts.courseId, id));
      await trx.delete(studentCourses).where(eq(studentCourses.courseId, id));
      await trx.delete(studentChapterProgress).where(eq(studentChapterProgress.courseId, id));
      await trx.delete(coursesSummaryStats).where(eq(coursesSummaryStats.courseId, id));

      const [deletedCourse] = await trx.delete(courses).where(eq(courses.id, id)).returning();

      if (!deletedCourse) {
        throw new ConflictException("Failed to delete course");
      }

      return null;
    });
  }

  async deleteManyCourses(ids: UUIDType[], currentUserRole: UserRole) {
    if (!ids.length) {
      throw new BadRequestException("No course ids provided");
    }

    if (currentUserRole !== USER_ROLES.ADMIN && currentUserRole !== USER_ROLES.CONTENT_CREATOR) {
      throw new ForbiddenException("You don't have permission to delete these courses");
    }

    const course = await this.db.select().from(courses).where(inArray(courses.id, ids));

    if (course.some((course) => course.status === "published")) {
      throw new ForbiddenException("You can't delete a published course");
    }

    return this.db.transaction(async (trx) => {
      await trx.delete(quizAttempts).where(inArray(quizAttempts.courseId, ids));
      await trx.delete(studentCourses).where(inArray(studentCourses.courseId, ids));
      await trx.delete(studentChapterProgress).where(inArray(studentChapterProgress.courseId, ids));
      await trx.delete(coursesSummaryStats).where(inArray(coursesSummaryStats.courseId, ids));

      const deletedCourses = await trx.delete(courses).where(inArray(courses.id, ids)).returning();

      if (!deletedCourses.length) {
        throw new ConflictException("Failed to delete courses");
      }

      return null;
    });
  }

  async unenrollCourse(id: UUIDType, userId: UUIDType) {
    const [course] = await this.db
      .select({
        id: courses.id,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

    if (!course.enrolled) throw new ConflictException("Course is not enrolled");

    await this.db.transaction(async (trx) => {
      const [deletedCourse] = await trx
        .delete(studentCourses)
        .where(and(eq(studentCourses.courseId, id), eq(studentCourses.studentId, userId)))
        .returning();

      if (!deletedCourse) throw new ConflictException("Course not unenrolled");

      const courseChapterList = await trx
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.courseId, id));

      const courseChapterIds = courseChapterList.map((l) => l.id);

      await trx
        .delete(studentChapterProgress)
        .where(
          and(
            eq(studentChapterProgress.courseId, id),
            inArray(studentChapterProgress.chapterId, courseChapterIds),
            eq(studentChapterProgress.studentId, userId),
          ),
        )
        .returning();

      const courseQuestionList = await trx
        .select({ id: questions.id })
        .from(questions)
        .leftJoin(lessons, eq(lessons.id, questions.lessonId))
        .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, id));
      const courseStudentQuestionIds = courseQuestionList.map((question) => question.id);

      await trx
        .delete(studentQuestionAnswers)
        .where(
          and(
            inArray(studentQuestionAnswers.questionId, courseStudentQuestionIds),
            eq(studentQuestionAnswers.studentId, userId),
          ),
        )
        .returning();

      await trx
        .delete(studentLessonProgress)
        .where(
          and(
            inArray(studentLessonProgress.lessonId, courseChapterIds),
            eq(studentLessonProgress.studentId, userId),
          ),
        )
        .returning();
    });
  }

  private async createStatisicRecordForCourse(
    courseId: UUIDType,
    paymentId: string | null,
    existingFreemiumLessonProgress: boolean,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    if (!paymentId) {
      return this.statisticsRepository.updateFreePurchasedCoursesStats(courseId, dbInstance);
    }

    if (existingFreemiumLessonProgress) {
      return this.statisticsRepository.updatePaidPurchasedCoursesStats(courseId, dbInstance);
    }

    return this.statisticsRepository.updatePaidPurchasedAfterFreemiumCoursesStats(
      courseId,
      dbInstance,
    );
  }

  private async addS3SignedUrlsToLessonsAndQuestions(lessons: AdminLessonWithContentSchema[]) {
    return await Promise.all(
      lessons.map(async (lesson) => {
        const updatedLesson = { ...lesson };
        if (
          lesson.fileS3Key &&
          (lesson.type === LESSON_TYPES.VIDEO || lesson.type === LESSON_TYPES.PRESENTATION)
        ) {
          if (!lesson.fileS3Key.startsWith("https://")) {
            try {
              const signedUrl = await this.fileService.getFileUrl(lesson.fileS3Key);
              return { ...updatedLesson, fileS3SignedUrl: signedUrl };
            } catch (error) {
              console.error(`Failed to get signed URL for ${lesson.fileS3Key}:`, error);
            }
          }
        }

        if (lesson.questions && Array.isArray(lesson.questions)) {
          const questionsWithSignedUrls = await Promise.all(
            lesson.questions.map(async (question) => {
              if (question.photoS3Key) {
                if (!question.photoS3Key.startsWith("https://")) {
                  try {
                    const signedUrl = await this.fileService.getFileUrl(question.photoS3Key);
                    return { ...question, photoS3SingedUrl: signedUrl };
                  } catch (error) {
                    console.error(
                      `Failed to get signed URL for question thumbnail ${question.photoS3Key}:`,
                      error,
                    );
                  }
                }
              }
              return question;
            }),
          );
          updatedLesson.questions = questionsWithSignedUrls;
        }

        return updatedLesson;
      }),
    );
  }

  private getSelectField() {
    return {
      id: courses.id,
      description: sql<string>`${courses.description}`,
      title: courses.title,
      thumbnailUrl: courses.thumbnailS3Key,
      authorId: sql<string>`${courses.authorId}`,
      author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
      authorEmail: sql<string>`${users.email}`,
      authorAvatarUrl: sql<string>`${users.avatarReference}`,
      category: sql<string>`${categories.title}`,
      enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
      enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
      courseChapterCount: courses.chapterCount,
      completedChapterCount: sql<number>`COALESCE(${studentCourses.finishedChapterCount}, 0)`,
      priceInCents: courses.priceInCents,
      currency: courses.currency,
      hasFreeChapter: sql<boolean>`
        EXISTS (
          SELECT 1
          FROM ${chapters}
          WHERE ${chapters.courseId} = ${courses.id}
            AND ${chapters.isFreemium} = TRUE
        )`,
    };
  }

  private getFiltersConditions(filters: CoursesFilterSchema, publishedOnly = true) {
    const conditions = [];
    if (filters.title) {
      conditions.push(ilike(courses.title, `%${filters.title.toLowerCase()}%`));
    }
    if (filters.description) {
      conditions.push(ilike(courses.description, `%${filters.description}%`));
    }
    if (filters.searchQuery) {
      const searchCondition = or(
        ilike(courses.title, `%${filters.searchQuery}%`),
        ilike(courses.description, `%${filters.searchQuery}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    if (filters.category) {
      conditions.push(like(categories.title, `%${filters.category}%`));
    }
    if (filters.author) {
      const authorNameConcat = sql`CONCAT(${users.firstName}, ' ' , ${users.lastName})`;
      conditions.push(sql`${authorNameConcat} LIKE ${`%${filters.author}%`}`);
    }
    if (filters.creationDateRange) {
      const [startDate, endDate] = filters.creationDateRange;
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();

      conditions.push(between(courses.createdAt, start, end));
    }
    if (filters.status) {
      conditions.push(eq(courses.status, filters.status));
    }

    if (publishedOnly) {
      conditions.push(eq(courses.status, "published"));
    }

    return conditions ?? undefined;
  }

  private getColumnToSortBy(sort: CourseSortField) {
    switch (sort) {
      case CourseSortFields.author:
        return sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`;
      case CourseSortFields.category:
        return categories.title;
      case CourseSortFields.creationDate:
        return courses.createdAt;
      case CourseSortFields.chapterCount:
        return count(studentCourses.courseId);
      case CourseSortFields.enrolledParticipantsCount:
        return count(studentCourses.courseId);
      default:
        return courses.title;
    }
  }

  private async getAvailableCourseIds(
    trx: PostgresJsDatabase<typeof schema>,
    currentUserId?: UUIDType,
    authorId?: UUIDType,
    excludeCourseId?: UUIDType,
  ) {
    const conditions = [];
    if (authorId) {
      conditions.push(eq(courses.authorId, authorId));
    }

    if (excludeCourseId) {
      conditions.push(ne(courses.id, excludeCourseId));
    }

    const availableCourses: Record<string, string>[] = await trx.execute(sql`
      SELECT ${courses.id} AS "courseId"
      FROM ${courses}
      WHERE ${conditions.length ? and(...conditions) : true} AND ${courses.id} NOT IN (
        SELECT DISTINCT ${studentCourses.courseId}
        FROM ${studentCourses}
        WHERE ${studentCourses.studentId} = ${currentUserId}
      )
    `);

    return availableCourses.map(({ courseId }) => courseId);
  }

  async getCourseStatistics(id: UUIDType): Promise<CourseStatisticsResponse> {
    const [courseStats] = await this.db
      .select({
        enrolledCount: sql<number>`COUNT(DISTINCT ${studentCourses.studentId})::int`,
        completionPercentage: sql<number>`COALESCE(
          (
            SELECT
              ROUND(
                (CAST(completed_count AS DECIMAL) /
                 NULLIF(total_count, 0)) * 100, 2)
            FROM (
              SELECT
                COUNT(DISTINCT CASE WHEN sc.progress = 'completed' THEN sc.student_id END) AS completed_count,
                COUNT(DISTINCT sc.student_id) AS total_count
              FROM ${studentCourses} AS sc
              WHERE sc.course_id = ${id}
            ) AS stats
          ),
          0
        )::float`,
        averageCompletionPercentage: sql<number>`COALESCE(
          (
            SELECT
              ROUND((CAST(total_completed AS DECIMAL) / NULLIF(total_rows, 0)) * 100, 0)
            FROM (
              SELECT
                COUNT(*) FILTER (WHERE slp.completed_at IS NOT NULL) AS total_completed,
                COUNT(*) AS total_rows
              FROM ${studentLessonProgress} AS slp
              JOIN ${lessons} AS l ON slp.lesson_id = l.id
              JOIN ${chapters} AS ch ON l.chapter_id = ch.id
              WHERE ch.course_id = ${id}
            ) AS stats
          ),
          0
        )::float`,
        courseStatusDistribution: sql<CourseStatusDistribution>`COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('status', progress, 'count', count)) FROM (
              SELECT
                sc.progress AS progress,
                COUNT(*) AS count
              FROM ${studentCourses} AS sc
              WHERE sc.course_id = ${id}
              GROUP BY sc.progress
            ) AS progress_counts
          ),
          '[]'::jsonb
        )`,
      })
      .from(coursesSummaryStats)
      .leftJoin(studentCourses, eq(coursesSummaryStats.courseId, studentCourses.courseId))
      .where(eq(coursesSummaryStats.courseId, id));

    return courseStats;
  }

  async getAverageQuizScoreForCourse(courseId: UUIDType): Promise<CourseAverageQuizScoresResponse> {
    const [averageScorePerQuiz] = await this.db
      .select({
        averageScoresPerQuiz: sql<CourseAverageQuizScorePerQuiz[]>`COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('quizId', subquery.quiz_id, 'name', subquery.quiz_name, 'averageScore', subquery.average_score, 'finishedCount', subquery.finished_count))
            FROM (
              SELECT
                l.id AS quiz_id,
                l.title AS quiz_name,
                ROUND(AVG(slp.quiz_score), 0) AS average_score,
                COUNT(DISTINCT slp.student_id) AS finished_count
              FROM ${lessons} l
              JOIN ${studentLessonProgress} slp ON l.id = slp.lesson_id
              JOIN ${chapters} c ON l.chapter_id = c.id
              WHERE c.course_id = ${courseId} AND l.type = 'quiz' AND slp.completed_at IS NOT NULL AND slp.quiz_score IS NOT NULL
              GROUP BY l.id, l.title
            ) AS subquery
          ),
          '[]'::jsonb
        )`,
      })
      .from(studentLessonProgress)
      .leftJoin(chapters, eq(studentLessonProgress.chapterId, chapters.id))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(courses.id, courseId));

    return averageScorePerQuiz;
  }

  async getStudentsProgress(query: CourseStudentProgressionQuery) {
    const {
      courseId,
      sort = CourseStudentProgressionSortFields.studentName,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      searchQuery = "",
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
    } = this.getStudentCourseStatisticsExpressions(courseId);

    const studentsProgress = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        groupName: groupNameExpression,
        completedLessonsCount: completedLessonsCountExpression,
        lastActivity: lastActivityExpression,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          or(
            ilike(users.firstName, `%${searchQuery}%`),
            ilike(users.lastName, `%${searchQuery}%`),
            ilike(groups.name, `%${searchQuery}%`),
          ),
        ),
      )
      .limit(perPage)
      .offset((page - 1) * perPage)
      .orderBy(
        sortOrder(
          this.getCourseStatisticsColumnToSortBy(
            sortedField as CourseStudentProgressionSortField,
            courseId,
          ),
        ),
      );

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          or(
            ilike(users.firstName, `%${searchQuery}%`),
            ilike(users.lastName, `%${searchQuery}%`),
            ilike(groups.name, `%${searchQuery}%`),
          ),
        ),
      );

    const allStudentsProgress = await Promise.all(
      studentsProgress.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsProgress,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsQuizResults(query: CourseStudentQuizResultsQuery) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      quizId = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
    } = query;

    const conditions = [
      eq(studentCourses.courseId, courseId),
      isNotNull(studentLessonProgress.completedAt),
      isNotNull(studentLessonProgress.attempts),
    ];

    if (quizId) conditions.push(eq(lessons.id, quizId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const { lastAttemptExpression, studentNameExpression, quizNameExpression } =
      this.getStudentCourseStatisticsExpressions(courseId);

    const quizResults = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        quizName: quizNameExpression,
        attempts: sql<number>`${studentLessonProgress.attempts}`,
        quizScore: sql<number>`${studentLessonProgress.quizScore}`,
        lastAttempt: lastAttemptExpression,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(studentLessonProgress, eq(studentLessonProgress.studentId, users.id))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .orderBy(
        sortOrder(
          this.getCourseStatisticsColumnToSortBy(
            sortedField as CourseStudentQuizResultsSortField,
            courseId,
          ),
        ),
      )
      .limit(perPage)
      .offset((page - 1) * perPage)
      .where(and(...conditions));

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentLessonProgress)
      .leftJoin(studentCourses, eq(studentLessonProgress.studentId, studentCourses.studentId))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .where(and(...conditions));

    const allStudentsResults = await Promise.all(
      quizResults.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsResults,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsAiMentorResults(query: CourseStudentAiMentorResultsQuery) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      lessonId = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
    } = query;

    const conditions = [
      eq(studentCourses.courseId, courseId),
      eq(lessons.type, LESSON_TYPES.AI_MENTOR),
      eq(studentLessonProgress.id, aiMentorStudentLessonProgress.studentLessonProgressId),
    ];

    if (lessonId) conditions.push(eq(lessons.id, lessonId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const { studentNameExpression } = this.getStudentCourseStatisticsExpressions(courseId);

    const quizResults = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        lessonName: sql<string>`${lessons.title}`,
        score: sql<number>`${aiMentorStudentLessonProgress.percentage}`,
        lastSession: sql<string>`TO_CHAR(${aiMentorStudentLessonProgress.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(studentLessonProgress, eq(studentLessonProgress.studentId, users.id))
      .leftJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .orderBy(
        sortOrder(
          this.getCourseStatisticsColumnToSortBy(
            sortedField as CourseStudentAiMentorResultsSortField,
            courseId,
          ),
        ),
      )
      .limit(perPage)
      .offset((page - 1) * perPage)
      .where(and(...conditions));

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(aiMentorStudentLessonProgress)
      .leftJoin(
        studentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(studentCourses, eq(studentLessonProgress.studentId, studentCourses.studentId))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .where(and(...conditions));

    const allStudentsResults = await Promise.all(
      quizResults.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsResults,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  private getCourseStatisticsColumnToSortBy(
    sort:
      | CourseStudentProgressionSortField
      | CourseStudentQuizResultsSortField
      | CourseStudentAiMentorResultsSortField,
    courseId: UUIDType,
  ) {
    const {
      lastAttemptExpression,
      studentNameExpression,
      quizNameExpression,
      groupNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
    } = this.getStudentCourseStatisticsExpressions(courseId);

    switch (sort) {
      case CourseStudentProgressionSortFields.studentName:
        return studentNameExpression;
      case CourseStudentProgressionSortFields.groupName:
        return groupNameExpression;
      case CourseStudentProgressionSortFields.lastActivity:
        return lastActivityExpression;
      case CourseStudentProgressionSortFields.completedLessonsCount:
        return completedLessonsCountExpression;
      case CourseStudentQuizResultsSortFields.quizName:
        return quizNameExpression;
      case CourseStudentQuizResultsSortFields.lastAttempt:
        return lastAttemptExpression;
      case CourseStudentQuizResultsSortFields.attempts:
        return studentLessonProgress.attempts;
      case CourseStudentQuizResultsSortFields.quizScore:
        return studentLessonProgress.quizScore;
      case CourseStudentAiMentorResultsSortFields.lessonName:
        return lessons.title;
      case CourseStudentAiMentorResultsSortFields.score:
        return aiMentorStudentLessonProgress.percentage;
      case CourseStudentAiMentorResultsSortFields.lastSession:
        return aiMentorStudentLessonProgress.updatedAt;
      default:
        return studentNameExpression;
    }
  }

  private getStudentCourseStatisticsExpressions(courseId: UUIDType) {
    const studentNameExpression = sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`;

    const lastActivityExpression = sql<string | null>`(
          SELECT TO_CHAR(MAX(slp.completed_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courseId}
        )`;

    const completedLessonsCountExpression = sql<number>`COALESCE((
          SELECT COUNT(*)
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courseId}
            AND slp.completed_at IS NOT NULL
        ), 0)::float`;

    const groupNameExpression = sql<string | null>`(
          SELECT g.name
          FROM ${groups} g
          JOIN ${groupUsers} gu ON gu.group_id = g.id
          WHERE gu.user_id = ${users.id}
        )`;

    const lastAttemptExpression = sql<string>`(
          SELECT TO_CHAR(MAX(slp.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND slp.chapter_id = ch.id
            AND ch.course_id = ${courseId}
        )`;

    const quizNameExpression = sql<string>`(
          SELECT l.title
          FROM ${lessons} l
          WHERE l.id = ${studentLessonProgress.lessonId}
            AND l.type = 'quiz'
        )`;

    return {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastAttemptExpression,
      quizNameExpression,
    };
  }

  async getCourseName(courseId: UUIDType) {
    const [{ courseName }] = await this.db
      .select({ courseName: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId));

    return courseName;
  }

  async getChapterName(chapterId: UUIDType) {
    const [{ chapterName }] = await this.db
      .select({ chapterName: chapters.title })
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    return chapterName;
  }
}
