import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { BaseEmailTemplate } from "@repo/email-templates";
import { COURSE_ENROLLMENT, SUPPORTED_LANGUAGES } from "@repo/shared";
import {
  and,
  between,
  count,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  not,
  or,
  sql,
} from "drizzle-orm";
import { camelCase, isEmpty, isEqual, pickBy } from "lodash";

import { AiService } from "src/ai/services/ai.service";
import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getGroupFilterConditions } from "src/common/helpers/getGroupFilterConditions";
import { buildJsonbField, deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { EnvService } from "src/env/services/env.service";
import { CreateCourseEvent, UpdateCourseEvent, EnrollCourseEvent } from "src/events";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { FileService } from "src/file/file.service";
import { LearningTimeRepository } from "src/learning-time";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import {
  groupCourses,
  aiMentorStudentLessonProgress,
  categories,
  certificates,
  chapters,
  courses,
  coursesSummaryStats,
  groups,
  groupUsers,
  lessonLearningTime,
  lessons,
  questionAnswerOptions,
  questions,
  quizAttempts,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";
import { hasLocalizableUpdates } from "src/utils/getLocalizableKeys";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { getSortOptions } from "../common/helpers/getSortOptions";

import { LESSON_SEQUENCE_ENABLED } from "./constants";
import {
  COURSE_ENROLLMENT_SCOPES,
  CourseSortFields,
  CourseStudentAiMentorResultsSortFields,
  CourseStudentProgressionSortFields,
  CourseStudentQuizResultsSortFields,
  EnrolledStudentSortFields,
} from "./schemas/courseQuery";

import type {
  AllCoursesForContentCreatorResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
  CourseAverageQuizScorePerQuiz,
  CourseAverageQuizScoresResponse,
  CourseStatisticsQueryBody,
  CourseStatisticsResponse,
  CourseStatusDistribution,
  EnrolledCourseGroupsPayload,
  LessonSequenceEnabledResponse,
} from "./schemas/course.schema";
import type {
  CourseEnrollmentScope,
  CoursesFilterSchema,
  CourseSortField,
  CoursesQuery,
  CourseStudentAiMentorResultsQuery,
  CourseStudentAiMentorResultsSortField,
  CourseStudentProgressionQuery,
  CourseStudentProgressionSortField,
  CourseStudentQuizResultsQuery,
  CourseStudentQuizResultsSortField,
  EnrolledStudentSortField,
  EnrolledStudentsQuery,
} from "./schemas/courseQuery";
import type { CreateCourseBody } from "./schemas/createCourse.schema";
import type { CreateCoursesEnrollment } from "./schemas/createCoursesEnrollment";
import type { StudentCourseSelect } from "./schemas/enrolledStudent.schema";
import type { CommonShowBetaCourse, CommonShowCourse } from "./schemas/showCourseCommon.schema";
import type { UpdateCourseBody } from "./schemas/updateCourse.schema";
import type { UpdateCourseSettings } from "./schemas/updateCourseSettings.schema";
import type { CoursesSettings } from "./types/settings";
import type { SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { Pagination, UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { CourseTranslationType } from "src/courses/types/course.types";
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
    private readonly settingsService: SettingsService,
    private readonly stripeService: StripeService,
    private readonly envService: EnvService,
    private readonly localizationService: LocalizationService,
    private readonly eventBus: EventBus,
    private readonly aiService: AiService,
    private readonly adminLessonService: AdminLessonService,
    private readonly learningTimeRepository: LearningTimeRepository,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
    private readonly emailService: EmailService,
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
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const conditions = this.getFiltersConditions(filters, false);

    if (currentUserRole === USER_ROLES.CONTENT_CREATOR && currentUserId) {
      conditions.push(eq(courses.authorId, currentUserId));
    }

    const queryDB = this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
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
        courses.availableLocales,
        courses.baseLanguage,
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
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db.transaction(async (trx) => {
      const conditions = [
        eq(studentCourses.studentId, userId),
        eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        or(eq(courses.status, "published"), eq(courses.status, "private")),
        isNull(users.deletedAt),
      ];
      conditions.push(...this.getFiltersConditions(filters, false));

      const queryDB = trx
        .select(this.getSelectField(language))
        .from(studentCourses)
        .innerJoin(courses, eq(studentCourses.courseId, courses.id))
        .innerJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
        .leftJoin(
          groupCourses,
          and(
            eq(groupCourses.courseId, courses.id),
            eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
          ),
        )
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
          courses.availableLocales,
          courses.baseLanguage,
          groupCourses.dueDate,
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

  async getStudentsWithEnrollmentDate(query: EnrolledStudentsQuery) {
    const { courseId, filters = {}, page = 1, perPage = DEFAULT_PAGE_SIZE } = query;
    const { keyword, sort = EnrolledStudentSortFields.enrolledAt } = filters;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const conditions = [
      eq(users.role, USER_ROLES.STUDENT),
      eq(users.archived, false),
      isNull(users.deletedAt),
    ];

    if (keyword) {
      const searchKeyword = keyword.toLowerCase();

      const keywordCondition = or(
        ilike(users.firstName, `%${searchKeyword}%`),
        ilike(users.lastName, `%${searchKeyword}%`),
        ilike(users.email, `%${searchKeyword}%`),
      );

      if (keywordCondition) {
        conditions.push(keywordCondition);
      }
    }

    if (filters.groups?.length) {
      conditions.push(getGroupFilterConditions(filters.groups));
    }

    const data = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        id: users.id,
        enrolledAt: sql<
          string | null
        >`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN ${studentCourses.enrolledAt} ELSE NULL END`,
        groups: sql<
          Array<{ id: string; name: string }>
        >`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${groups.id}, 'name', ${groups.name})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as(
          "groups",
        ),
        isEnrolledByGroup: sql<boolean>`${studentCourses.enrolledByGroupId} IS NOT NULL`,
      })
      .from(users)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions))
      .groupBy(
        users.id,
        studentCourses.enrolledAt,
        studentCourses.status,
        studentCourses.enrolledByGroupId,
      )
      .orderBy(
        sortOrder(this.getEnrolledStudentsColumnToSortBy(sortedField as EnrolledStudentSortField)),
      )
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(users.id) })
      .from(users)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions));

    return {
      data: data ?? [],
      pagination: {
        totalItems: totalItems || 0,
        page,
        perPage,
      },
    };
  }

  private getEnrolledStudentsColumnToSortBy(field: EnrolledStudentSortField) {
    switch (field) {
      case EnrolledStudentSortFields.firstName:
        return users.firstName;
      case EnrolledStudentSortFields.lastName:
        return users.lastName;
      case EnrolledStudentSortFields.email:
        return users.email;
      case EnrolledStudentSortFields.isEnrolledByGroup:
        return sql`CASE WHEN ${studentCourses.enrolledByGroupId} IS NULL THEN 0 ELSE 1 END`;
      case EnrolledStudentSortFields.enrolledAt:
      default:
        return studentCourses.enrolledAt;
    }
  }

  async getCourseSequenceEnabled(courseId: UUIDType): Promise<LessonSequenceEnabledResponse> {
    const course = await this.db.query.courses.findFirst({
      where: (courses, { eq }) => eq(courses.id, courseId),
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return {
      lessonSequenceEnabled: course?.settings.lessonSequenceEnabled,
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
      language,
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
          title: this.localizationService.getLocalizedSqlField(courses.title, language),
          description: this.localizationService.getLocalizedSqlField(courses.description, language),
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
          dueDate: sql<
            string | null
          >`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        })
        .from(courses)
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .leftJoin(users, eq(courses.authorId, users.id))
        .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
        .leftJoin(
          studentCourses,
          and(
            eq(studentCourses.courseId, courses.id),
            currentUserId ? eq(studentCourses.studentId, currentUserId) : sql`FALSE`,
          ),
        )
        .leftJoin(
          groupCourses,
          and(
            eq(groupCourses.courseId, courses.id),
            eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
          ),
        )
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
          courses.availableLocales,
          courses.baseLanguage,
          groupCourses.dueDate,
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

  async getCourse(
    id: UUIDType,
    userId: UUIDType,
    language: SupportedLanguages,
  ): Promise<CommonShowCourse> {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        thumbnailS3Key: sql<string>`${courses.thumbnailS3Key}`,
        category: sql<string>`${categories.title}`,
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentCourses.finishedChapterCount}, 0) ELSE 0 END`,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
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
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
      )
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, courses.id),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
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
        title: this.localizationService.getLocalizedSqlField(chapters.title, language),
        isSubmitted: sql<boolean>`
          EXISTS (
            SELECT 1
            FROM ${studentChapterProgress}
            JOIN ${studentCourses} ON ${studentCourses.courseId} = ${course.id} AND ${studentCourses.studentId} = ${studentChapterProgress.studentId}
            WHERE ${studentChapterProgress.chapterId} = ${chapters.id}
              AND ${studentChapterProgress.courseId} = ${course.id}
              AND ${studentChapterProgress.studentId} = ${userId}
              AND ${studentChapterProgress.completedAt} IS NOT NULL
              AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
          )::BOOLEAN`,
        lessonCount: chapters.lessonCount,
        quizCount: sql<number>`
          (SELECT COUNT(*)
          FROM ${lessons}
          WHERE ${lessons.chapterId} = ${chapters.id}
            AND ${lessons.type} = ${LESSON_TYPES.QUIZ})::INTEGER`,
        completedLessonCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentChapterProgress.completedLessonCount}, 0) ELSE 0 END`,
        chapterProgress: sql<ProgressStatus>`
          CASE
          WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.NOT_ENROLLED} THEN ${PROGRESS_STATUSES.NOT_STARTED}
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
                  ${this.localizationService.getLocalizedSqlField(
                    lessons.title,
                    language,
                  )} AS title,
                  ${lessons.type} AS type,
                  ${lessons.displayOrder} AS "displayOrder",
                  ${lessons.isExternal} AS "isExternal",
                  CASE
                    WHEN (${chapters.isFreemium} = FALSE AND ${isEnrolled} = FALSE) THEN ${
                      PROGRESS_STATUSES.BLOCKED
                    }
                    WHEN ${studentLessonProgress.completedAt} IS NOT NULL AND (${
                      studentLessonProgress.isQuizPassed
                    } IS TRUE OR ${studentLessonProgress.isQuizPassed} IS NULL) THEN ${
                      PROGRESS_STATUSES.COMPLETED
                    }
                    WHEN ${studentLessonProgress.isStarted} THEN  ${PROGRESS_STATUSES.IN_PROGRESS}
                    ELSE  ${PROGRESS_STATUSES.NOT_STARTED}
                  END AS status,
                  CASE
                    WHEN ${lessons.type} = ${LESSON_TYPES.QUIZ} THEN COUNT(${questions.id})
                    ELSE NULL
                  END AS "quizQuestionCount"
                FROM ${lessons}
                LEFT JOIN ${studentLessonProgress} ON ${lessons.id} = ${
                  studentLessonProgress.lessonId
                }
                  AND ${studentLessonProgress.studentId} = ${userId}
                LEFT JOIN ${questions} ON ${lessons.id} = ${questions.lessonId}
                LEFT JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
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
                  ${studentLessonProgress.isQuizPassed},
                  ${courses.availableLocales},
                  ${courses.baseLanguage}
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
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, course.id), eq(studentCourses.studentId, userId)),
      )
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);

    const thumbnailUrl = await this.fileService.getFileUrl(course.thumbnailS3Key);

    return {
      ...course,
      thumbnailUrl,
      chapters: courseChapterList,
    };
  }

  async getBetaCourseById(
    id: UUIDType,
    language: SupportedLanguages,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ): Promise<CommonShowBetaCourse> {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: this.localizationService.getFieldByLanguage(courses.title, language),
        thumbnailS3Key: sql<string>`COALESCE(${courses.thumbnailS3Key}, '')`,
        category: categories.title,
        categoryId: categories.id,
        description: this.localizationService.getFieldByLanguage(courses.description, language),
        courseChapterCount: courses.chapterCount,
        status: courses.status,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        hasCertificate: courses.hasCertificate,
        availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
        baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
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
        title: this.localizationService.getFieldByLanguage(chapters.title, language),
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
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
      .orderBy(chapters.displayOrder);

    const thumbnailS3SingedUrl = course.thumbnailS3Key
      ? await this.fileService.getFileUrl(course.thumbnailS3Key)
      : null;

    const updatedCourseLessonList = await Promise.all(
      courseChapterList?.map(async (chapter) => {
        const lessons: AdminLessonWithContentSchema[] =
          await this.adminChapterRepository.getBetaChapterLessons(chapter.id, language);

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

  async hasMissingTranslations(
    id: UUIDType,
    language: SupportedLanguages,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ): Promise<boolean> {
    const courseInRequestedLanguage = await this.getBetaCourseById(
      id,
      language,
      currentUserId,
      currentUserRole,
    );

    if (language === courseInRequestedLanguage.baseLanguage) return false;

    const courseInBaseLanguage = await this.getBetaCourseById(
      id,
      courseInRequestedLanguage.baseLanguage,
      currentUserId,
      currentUserRole,
    );

    return (
      this.collectMissingTranslationFields(
        id,
        courseInRequestedLanguage,
        courseInBaseLanguage,
        true,
      ).length > 0
    );
  }

  async getContentCreatorCourses({
    currentUserId,
    authorId,
    scope,
    excludeCourseId,
    title,
    description,
    searchQuery,
    language,
  }: {
    currentUserId: UUIDType;
    authorId: UUIDType;
    scope: CourseEnrollmentScope;
    excludeCourseId?: UUIDType;
    title?: string;
    description?: string;
    searchQuery?: string;
    language: SupportedLanguages;
  }): Promise<AllCoursesForContentCreatorResponse> {
    const conditions = [eq(courses.status, "published"), eq(courses.authorId, authorId)];

    if (scope === COURSE_ENROLLMENT_SCOPES.ENROLLED) {
      conditions.push(
        ...[
          eq(studentCourses.studentId, currentUserId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ],
      );
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
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.title
        }) AS t(k, v) WHERE v ILIKE ${`%${title}%`})`,
      );
    }

    if (description) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.description
        }) AS t(k, v) WHERE v ILIKE ${`%${description}%`})`,
      );
    }

    if (searchQuery) {
      const searchCondition = or(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.title
        }) AS t(k, v) WHERE v ILIKE ${`%${searchQuery}%`})`,
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.title
        }) AS t(k, v) WHERE v ILIKE ${`%${searchQuery}%`})`,
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const contentCreatorCourses = await this.db
      .select({
        id: courses.id,
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        thumbnailUrl: courses.thumbnailS3Key,
        authorId: sql<string>`${courses.authorId}`,
        author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        authorEmail: sql<string>`${users.email}`,
        authorAvatarUrl: sql<string>`${users.avatarReference}`,
        category: sql<string>`${categories.title}`,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN true ELSE false END`,
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
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, courses.id), eq(studentCourses.studentId, currentUserId)),
      )
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, courses.id),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
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
        courses.availableLocales,
        courses.baseLanguage,
        studentCourses.status,
        groupCourses.dueDate,
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

  async updateHasCertificate(
    courseId: UUIDType,
    hasCertificate: boolean,
    currentUser: CurrentUser,
  ) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const { language: resolvedLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    const previousSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    const [updatedCourse] = await this.db
      .update(courses)
      .set({ hasCertificate })
      .where(eq(courses.id, courseId))
      .returning();

    if (hasCertificate) {
      this.eventBus.publish(new UpdateHasCertificateEvent(courseId));
    }

    if (!updatedCourse) {
      throw new ConflictException("Failed to update course");
    }

    const updatedSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    if (this.areCourseSnapshotsEqual(previousSnapshot, updatedSnapshot)) return updatedCourse;

    this.eventBus.publish(
      new UpdateCourseEvent({
        courseId,
        actor: currentUser,
        previousCourseData: previousSnapshot,
        updatedCourseData: updatedSnapshot,
      }),
    );

    return updatedCourse;
  }

  async updateCourseSettings(
    courseId: UUIDType,
    settings: UpdateCourseSettings,
    currentUser: CurrentUser,
  ) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const { language: resolvedLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    const previousSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    const incomingSettings = pickBy(settings, (value) => value !== undefined && value !== null);
    const [updatedCourse] = await this.db
      .update(courses)
      .set({
        settings: { ...course.settings, ...incomingSettings },
      })
      .where(eq(courses.id, courseId))
      .returning();

    if (!updatedCourse) {
      throw new ConflictException("Failed to update course");
    }

    const updatedSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    if (this.areCourseSnapshotsEqual(previousSnapshot, updatedSnapshot)) return updatedCourse;

    this.eventBus.publish(
      new UpdateCourseEvent({
        courseId,
        actor: currentUser,
        previousCourseData: previousSnapshot,
        updatedCourseData: updatedSnapshot,
      }),
    );

    return updatedCourse;
  }

  async getCourseSettings(courseId: UUIDType): Promise<CoursesSettings> {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return course.settings;
  }

  private areCourseSnapshotsEqual(
    previousSnapshot: CourseActivityLogSnapshot | null,
    updatedSnapshot: CourseActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }

  async createCourse(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUser,
    isPlaywrightTest: boolean,
  ) {
    const newCourse = await this.db.transaction(async (trx) => {
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

      const settings = sql`json_build_object('lessonSequenceEnabled', ${LESSON_SEQUENCE_ENABLED}::boolean)`;

      const [newCourse] = await trx
        .insert(courses)
        .values({
          title: buildJsonbField(createCourseBody.language, createCourseBody.title),
          description: buildJsonbField(createCourseBody.language, createCourseBody.description),
          baseLanguage: createCourseBody.language,
          availableLocales: [createCourseBody.language],
          thumbnailS3Key: createCourseBody.thumbnailS3Key,
          status: createCourseBody.status,
          priceInCents: createCourseBody.priceInCents,
          currency: finalCurrency,
          isScorm: createCourseBody.isScorm,
          authorId: currentUser.userId,
          categoryId: createCourseBody.categoryId,
          stripeProductId: productId,
          stripePriceId: priceId,
          settings: settingsToJSONBuildObject(settings),
        })
        .returning();

      if (!newCourse) {
        throw new ConflictException("Failed to create course");
      }

      await trx
        .insert(coursesSummaryStats)
        .values({ courseId: newCourse.id, authorId: currentUser.userId });

      return newCourse;
    });

    const createdCourseSnapshot = await this.buildCourseActivitySnapshot(
      newCourse.id,
      createCourseBody.language,
    );

    this.eventBus.publish(
      new CreateCourseEvent({
        courseId: newCourse.id,
        actor: currentUser,
        createdCourse: createdCourseSnapshot,
      }),
    );

    return newCourse;
  }

  async updateCourse(
    id: UUIDType,
    updateCourseBody: UpdateCourseBody,
    currentUser: CurrentUser,
    isPlaywrightTest: boolean,
    image?: Express.Multer.File,
  ) {
    const { userId: currentUserId, role: currentUserRole } = currentUser;

    const { updatedCourse, previousCourseSnapshot, updatedCourseSnapshot } =
      await this.db.transaction(async (trx) => {
        const [existingCourse] = await trx.select().from(courses).where(eq(courses.id, id));

        const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

        if (!updateCourseBody.language) {
          throw new BadRequestException("adminCourseView.toast.updateCourseMissingLanguage");
        }

        if (
          !existingCourse.availableLocales.includes(updateCourseBody.language) &&
          hasLocalizableUpdates(courses, updateCourseBody)
        ) {
          throw new BadRequestException("adminCourseView.toast.languageNotSupported");
        }

        if (!existingCourse) {
          throw new NotFoundException("Course not found");
        }

        if (existingCourse.authorId !== currentUserId && currentUserRole !== USER_ROLES.ADMIN) {
          throw new ForbiddenException("You don't have permission to update course");
        }

        const previousSnapshot = await this.buildCourseActivitySnapshot(
          id,
          updateCourseBody.language,
          trx,
        );

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

        const { priceInCents, currency, title, description, language, ...rest } = updateCourseBody;

        const updateData = {
          ...rest,
          title: setJsonbField(courses.title, language, title),
          description: setJsonbField(courses.description, language, description),
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
              name: (updatedCourse.title as Record<string, string>)[updatedCourse.baseLanguage],
              description:
                (updatedCourse.description as Record<string, string>)[updatedCourse.baseLanguage] ??
                "",
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
            if (updateCourseBody.language === updatedCourse.baseLanguage) {
              const productUpdatePayload = {
                name: (updatedCourse.title as Record<string, string>)[updatedCourse.baseLanguage],
                description: (updatedCourse.description as Record<string, string>)[
                  updatedCourse.baseLanguage
                ],
              };

              await this.stripeService.updateProduct(
                updatedCourse.stripeProductId,
                productUpdatePayload,
              );
            }

            // --- stripe price update ---
            const hasPriceUpdate =
              updateCourseBody.priceInCents !== undefined ||
              updateCourseBody.currency !== undefined;

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
                await this.stripeService.updatePrice(updatedCourse.stripePriceId, {
                  active: false,
                });

                await trx
                  .update(courses)
                  .set({ stripePriceId: newStripePrice.id })
                  .where(eq(courses.id, id));
              }
            }
          }
        }

        const updatedSnapshot = await this.buildCourseActivitySnapshot(id, language, trx);

        return {
          updatedCourse,
          previousCourseSnapshot: previousSnapshot,
          updatedCourseSnapshot: updatedSnapshot,
        };
      });

    if (this.areCourseSnapshotsEqual(previousCourseSnapshot, updatedCourseSnapshot)) {
      return updatedCourse;
    }

    this.eventBus.publish(
      new UpdateCourseEvent({
        courseId: id,
        actor: currentUser,
        previousCourseData: previousCourseSnapshot,
        updatedCourseData: updatedCourseSnapshot,
      }),
    );

    return updatedCourse;
  }

  async enrollCourse(
    id: UUIDType,
    studentId: UUIDType,
    testKey?: string,
    paymentId?: string,
    currentUser?: CurrentUser,
  ) {
    const [course] = await this.db
      .select({
        id: courses.id,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        price: courses.priceInCents,
        userDeletedAt: users.deletedAt,
      })
      .from(courses)
      .leftJoin(users, eq(users.id, studentId))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, studentId)),
      )
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

    if (course.userDeletedAt) {
      throw new NotFoundException("User not found");
    }

    if (course.enrolled) throw new ConflictException("Course is already enrolled");

    await this.db.transaction(async (trx) => {
      await this.createStudentCourse(id, studentId, paymentId, null);
      await this.createCourseDependencies(id, studentId, paymentId, trx);
    });

    if (currentUser) {
      this.eventBus.publish(
        new EnrollCourseEvent({
          courseId: id,
          userId: studentId,
          actor: currentUser,
        }),
      );
    }
  }

  async enrollCourses(courseId: UUIDType, body: CreateCoursesEnrollment, currentUser: CurrentUser) {
    const { studentIds } = body;

    const courseExists = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!courseExists.length) throw new NotFoundException(`Course ${courseId} not found`);
    if (!studentIds.length) throw new BadRequestException("Student ids not found");

    const existingStudentsEnrollments = await this.db
      .select({
        studentId: studentCourses.studentId,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          inArray(studentCourses.studentId, studentIds),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    const studentsToEnroll = await this.db
      .select()
      .from(users)
      .where(and(inArray(users.id, studentIds), isNull(users.deletedAt)));

    if (studentsToEnroll.length !== studentIds.length)
      throw new BadRequestException("You can only enroll existing users");

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
          enrolledAt: sql`NOW()`,
          status: COURSE_ENROLLMENT.ENROLLED,
          enrolledByGroupId: null,
        };
      });

      await trx
        .insert(studentCourses)
        .values(studentCoursesValues)
        .onConflictDoUpdate({
          target: [studentCourses.studentId, studentCourses.courseId],
          set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
        });

      await Promise.all(
        studentIds.map(async (studentId) => {
          await this.createCourseDependencies(courseId, studentId, null, trx);
        }),
      );
    });

    this.eventBus.publish(new UsersAssignedToCourseEvent({ studentIds, courseId }));
    studentIds.forEach((studentId) =>
      this.eventBus.publish(
        new EnrollCourseEvent({
          courseId,
          userId: studentId,
          actor: currentUser,
        }),
      ),
    );
  }

  async enrollGroupsToCourse(
    courseId: UUIDType,
    groupsToEnroll: EnrolledCourseGroupsPayload["groups"],
    userId?: UUIDType,
    currentUserRole?: UserRole,
  ) {
    const groupIds = groupsToEnroll.map((group) => group.id);
    const groupInfoById = new Map(groupsToEnroll.map((group) => [group.id, group]));

    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));
    if (!course) throw new NotFoundException(`Course ${courseId} not found`);

    const groupExists = await this.db.select().from(groups).where(inArray(groups.id, groupIds));
    if (!groupExists.length) throw new NotFoundException("Groups not found");

    if (currentUserRole === USER_ROLES.CONTENT_CREATOR && userId !== course.authorId) {
      throw new ForbiddenException("You don't have permission to enroll groups to this course");
    }

    let newStudentIds: string[] = [];

    await this.db.transaction(async (trx) => {
      const groupIdsArray = sql`ARRAY[${sql.join(
        groupIds.map((groupId) => sql`${groupId}::uuid`),
        sql`, `,
      )}]`;

      const groupCoursesValues = groupIds.map((groupId) => {
        const { isMandatory, dueDate } = groupInfoById.get(groupId) || {};

        return {
          groupId,
          courseId,
          enrolledBy: userId || null,
          isMandatory: isMandatory ?? false,
          dueDate: dueDate ? new Date(dueDate) : null,
        };
      });

      await trx
        .insert(groupCourses)
        .values(groupCoursesValues)
        .onConflictDoUpdate({
          target: [groupCourses.groupId, groupCourses.courseId],
          set: {
            isMandatory: sql`EXCLUDED.is_mandatory`,
            enrolledBy: sql`EXCLUDED.enrolled_by`,
            dueDate: sql`EXCLUDED.due_date`,
          },
        });

      const groupOrder = sql<number>`array_position(${groupIdsArray}, ${groupUsers.groupId})`;

      const eligibleStudents = await trx
        .selectDistinctOn([groupUsers.userId], {
          studentId: groupUsers.userId,
          groupId: groupUsers.groupId,
        })
        .from(groupUsers)
        .innerJoin(users, eq(users.id, groupUsers.userId))
        .leftJoin(
          studentCourses,
          and(
            eq(studentCourses.studentId, groupUsers.userId),
            eq(studentCourses.courseId, courseId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        )
        .where(
          and(
            inArray(groupUsers.groupId, groupIds),
            eq(users.role, USER_ROLES.STUDENT),
            isNull(studentCourses.id),
          ),
        )
        .orderBy(groupUsers.userId, desc(groupOrder));

      if (eligibleStudents.length) {
        const insertedStudents = await trx
          .insert(studentCourses)
          .values(
            eligibleStudents.map(({ studentId, groupId }) => ({
              studentId,
              courseId,
              enrolledByGroupId: groupId,
              status: COURSE_ENROLLMENT.ENROLLED,
            })),
          )
          .onConflictDoUpdate({
            target: [studentCourses.courseId, studentCourses.studentId],
            set: {
              enrolledAt: sql`EXCLUDED.enrolled_at`,
              status: sql`EXCLUDED.status`,
              enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
            },
          })
          .returning({ studentId: studentCourses.studentId });

        newStudentIds = insertedStudents.map((student) => student.studentId);

        await Promise.all(
          newStudentIds.map(async (studentId) => {
            await this.createCourseDependencies(courseId, studentId, null, trx);
          }),
        );
      }
    });

    this.eventBus.publish(new UsersAssignedToCourseEvent({ studentIds: newStudentIds, courseId }));
  }

  async unenrollGroupsFromCourse(courseId: UUIDType, groupIds: UUIDType[]) {
    const groupEnrollments = await this.db
      .select({ groupId: groupCourses.groupId })
      .from(groupCourses)
      .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));

    if (!groupEnrollments.length)
      throw new NotFoundException("No group enrollments found for the specified course and groups");

    const studentsToUnenroll = await this.db
      .select({ id: studentCourses.studentId })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          inArray(studentCourses.enrolledByGroupId, groupIds),
          eq(users.role, USER_ROLES.STUDENT),
        ),
      );

    const studentIdsToUnenroll = studentsToUnenroll.map((s) => s.id);

    await this.db.transaction(async (trx) => {
      await trx
        .delete(groupCourses)
        .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));

      if (!!studentIdsToUnenroll.length) {
        const studentsEnrolledInOtherGroups = await trx
          .select({
            studentId: groupUsers.userId,
            groupId: groupCourses.groupId,
          })
          .from(groupUsers)
          .innerJoin(groupCourses, eq(groupUsers.groupId, groupCourses.groupId))
          .where(
            and(
              inArray(groupUsers.userId, studentIdsToUnenroll),
              eq(groupCourses.courseId, courseId),
              not(inArray(groupCourses.groupId, groupIds)),
            ),
          )
          .orderBy(groupUsers.createdAt);

        const studentsWithOtherGroups = [
          ...new Set(studentsEnrolledInOtherGroups.map(({ studentId }) => studentId)),
        ];

        const studentsToCompletelyUnenroll = studentIdsToUnenroll.filter(
          (studentId) => !studentsWithOtherGroups.includes(studentId),
        );

        if (studentsWithOtherGroups.length) {
          await Promise.all(
            studentsWithOtherGroups.map((studentId) => {
              const newGroupId = studentsEnrolledInOtherGroups.find(
                (student) => student.studentId === studentId,
              )?.groupId;

              return trx
                .update(studentCourses)
                .set({
                  enrolledByGroupId: newGroupId,
                })
                .where(
                  and(
                    eq(studentCourses.courseId, courseId),
                    eq(studentCourses.studentId, studentId),
                  ),
                );
            }),
          );
        }

        if (studentsToCompletelyUnenroll.length) {
          await trx
            .update(studentCourses)
            .set({
              status: COURSE_ENROLLMENT.NOT_ENROLLED,
              enrolledAt: null,
              enrolledByGroupId: null,
            })
            .where(
              and(
                eq(studentCourses.courseId, courseId),
                inArray(studentCourses.studentId, studentsToCompletelyUnenroll),
              ),
            );
        }
      }
    });
  }

  async createStudentCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    enrolledByGroupId: UUIDType | null = null,
  ): Promise<StudentCourseSelect> {
    const [enrolledCourse] = await this.db
      .insert(studentCourses)
      .values({
        studentId,
        courseId,
        paymentId,
        enrolledAt: sql`NOW()`,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId,
      })
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
      })
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
    const alreadyHasEnrollmentRecord = Boolean(
      (
        await trx
          .select({ id: studentCourses.id })
          .from(studentCourses)
          .where(
            and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)),
          )
      ).length,
    );

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

    if (!alreadyHasEnrollmentRecord) {
      await this.createStatisicRecordForCourse(
        courseId,
        paymentId,
        isEmpty(existingLessonProgress),
        trx,
      );
    }

    if (courseChapterList.length > 0) {
      await trx
        .insert(studentChapterProgress)
        .values(
          courseChapterList.map((chapter) => ({
            studentId,
            chapterId: chapter.id,
            courseId,
            completedLessonItemCount: 0,
          })),
        )
        .onConflictDoNothing();

      await Promise.all(
        courseChapterList.map(async (chapter) => {
          const chapterLessons = await trx
            .select({ id: lessons.id, type: lessons.type })
            .from(lessons)
            .where(eq(lessons.chapterId, chapter.id));

          await trx
            .insert(studentLessonProgress)
            .values(
              chapterLessons.map((lesson) => ({
                studentId,
                lessonId: lesson.id,
                chapterId: chapter.id,
                completedQuestionCount: 0,
                quizScore: lesson.type === LESSON_TYPES.QUIZ ? 0 : null,
                completedAt: null,
              })),
            )
            .onConflictDoNothing();
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

  async unenrollCourse(courseId: UUIDType, userIds: UUIDType[]) {
    const studentEnrollments = await this.db
      .select({
        studentId: studentCourses.studentId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, userIds)),
      );

    const enrolledStudentIds = studentEnrollments.reduce<string[]>((studentIds, enrollment) => {
      if (enrollment.status === COURSE_ENROLLMENT.ENROLLED) studentIds.push(enrollment.studentId);
      return studentIds;
    }, []);

    const missingOrUnenrolledCount = userIds.length - enrolledStudentIds.length;

    if (missingOrUnenrolledCount > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.someStudentsUnenrolled",
        count: missingOrUnenrolledCount,
      });
    }

    const studentsEnrolledByGroup = studentEnrollments.filter(
      (enrollment) => enrollment.enrolledByGroupId,
    );

    if (studentsEnrolledByGroup.length > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.studentsEnrolledByGroup",
        count: studentsEnrolledByGroup.length,
      });
    }

    const studentsWithGroupEnrollment = await this.db
      .select({
        studentId: groupUsers.userId,
        groupId: groupCourses.groupId,
      })
      .from(groupUsers)
      .innerJoin(groupCourses, eq(groupUsers.groupId, groupCourses.groupId))
      .where(and(inArray(groupUsers.userId, userIds), eq(groupCourses.courseId, courseId)))
      .orderBy(groupUsers.createdAt);

    const studentGroupMap = new Map<string, string>();

    studentsWithGroupEnrollment.forEach(({ studentId, groupId }) => {
      if (!studentGroupMap.has(studentId)) {
        studentGroupMap.set(studentId, groupId);
      }
    });

    const studentsToUpdate = Array.from(studentGroupMap.keys());
    const studentsToUnenroll = userIds.filter((id) => !studentGroupMap.has(id));

    await this.db.transaction(async (trx) => {
      // Update students enrolled by groups to add group association
      if (studentsToUpdate.length > 0) {
        await Promise.all(
          Array.from(studentGroupMap.entries()).map(([studentId, groupId]) =>
            trx
              .update(studentCourses)
              .set({
                enrolledByGroupId: groupId,
              })
              .where(
                and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)),
              ),
          ),
        );
      }

      if (studentsToUnenroll.length > 0) {
        await trx
          .update(studentCourses)
          .set({
            enrolledAt: null,
            status: COURSE_ENROLLMENT.NOT_ENROLLED,
            enrolledByGroupId: null,
          })
          .where(
            and(
              inArray(studentCourses.studentId, studentsToUnenroll),
              eq(studentCourses.courseId, courseId),
            ),
          );
      }
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
        if (lesson.fileS3Key && lesson.type === LESSON_TYPES.CONTENT) {
          if (!lesson.fileS3Key.startsWith("https://")) {
            try {
              const signedUrl = await this.fileService.getFileUrl(lesson.fileS3Key);
              return { ...updatedLesson, fileS3SignedUrl: signedUrl };
            } catch (error) {
              console.error(`Failed to get signed URL for ${lesson.fileS3Key}:`, error);
            }
          }
        }

        if (lesson.type === LESSON_TYPES.AI_MENTOR && lesson.aiMentor?.avatarReference) {
          const signedUrl = await this.fileService.getFileUrl(lesson.aiMentor.avatarReference);

          return { ...updatedLesson, avatarReferenceUrl: signedUrl };
        }

        if (lesson.questions && Array.isArray(lesson.questions)) {
          updatedLesson.questions = await Promise.all(
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
        }

        return updatedLesson;
      }),
    );
  }

  private getSelectField(language: SupportedLanguages) {
    return {
      id: courses.id,
      title: this.localizationService.getLocalizedSqlField(courses.title, language),
      description: this.localizationService.getLocalizedSqlField(courses.description, language),
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
      dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    };
  }

  private getFiltersConditions(filters: CoursesFilterSchema, publishedOnly = true) {
    const conditions = [];

    if (filters.title) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.title
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.title}%`})`,
      );
    }

    if (filters.description) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.description
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.description}%`})`,
      );
    }

    if (filters.searchQuery) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.title
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`}) OR EXISTS (SELECT 1 FROM jsonb_each_text(${
          courses.description
        }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`})`,
      );
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
    if (!currentUserId) {
      return [];
    }

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

  async getCourseStatistics(
    id: UUIDType,
    query: CourseStatisticsQueryBody,
  ): Promise<CourseStatisticsResponse> {
    const userIds = await this.getUserIdsByGroup(query.groupId);

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
              WHERE sc.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
            ) AS stats
          ),
          0
        )::float`,
        averageCompletionPercentage: sql<number>`COALESCE(
        (
          SELECT
            ROUND((CAST(total_completed AS DECIMAL) / NULLIF(total_rows, 0)) * 100, 2)
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE slp.completed_at IS NOT NULL) AS total_completed,
              COUNT(*) AS total_rows
            FROM ${studentLessonProgress} AS slp
            JOIN ${lessons} AS l ON slp.lesson_id = l.id
            JOIN ${chapters} AS ch ON l.chapter_id = ch.id
            JOIN ${studentCourses} AS sc ON slp.student_id = sc.student_id AND ch.course_id = sc.course_id
            WHERE ch.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
            ${userIds.length ? sql`AND sc.student_id IN ${userIds}` : sql``}
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
              WHERE sc.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
              ${userIds.length ? sql`AND sc.student_id IN ${userIds}` : sql``}
              GROUP BY sc.progress
            ) AS progress_counts
          ),
          '[]'::jsonb
        )`,
      })
      .from(coursesSummaryStats)
      .leftJoin(studentCourses, eq(coursesSummaryStats.courseId, studentCourses.courseId))
      .where(
        and(
          eq(coursesSummaryStats.courseId, id),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ...(userIds.length ? [inArray(studentCourses.studentId, userIds)] : []),
        ),
      );

    const courseLearningTime = await this.learningTimeRepository.getCourseTotalLearningTime(
      id,
      userIds.length ? [inArray(lessonLearningTime.userId, userIds)] : [],
    );
    return { ...courseStats, averageSeconds: courseLearningTime.averageSeconds };
  }

  async getAverageQuizScoreForCourse(
    courseId: UUIDType,
    query: CourseStatisticsQueryBody,
    language: SupportedLanguages,
  ): Promise<CourseAverageQuizScoresResponse> {
    const conditions = await this.getStatisticsConditions(query);

    const [averageScorePerQuiz] = await this.db
      .select({
        averageScoresPerQuiz: sql<CourseAverageQuizScorePerQuiz[]>`COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('quizId', subquery.quiz_id, 'name', subquery.quiz_name, 'averageScore', subquery.average_score, 'finishedCount', subquery.finished_count, 'lessonOrder', subquery.lesson_order))
          FROM (
            SELECT
              ${lessons.id} AS quiz_id,
              ${this.localizationService.getLocalizedSqlField(
                lessons.title,
                language,
                courses,
              )} AS quiz_name,
              ${lessons.displayOrder} AS lesson_order,
              ROUND(AVG(${studentLessonProgress.quizScore}), 0) AS average_score,
              COUNT(DISTINCT ${studentLessonProgress.studentId}) AS finished_count
            FROM ${lessons}
            JOIN ${studentLessonProgress} ON ${lessons.id} = ${studentLessonProgress.lessonId}
            JOIN ${chapters} ON ${lessons.chapterId} = ${chapters.id}
            JOIN ${studentCourses} ON ${studentLessonProgress.studentId} = ${
              studentCourses.studentId
            } AND ${studentCourses.courseId} = ${chapters.courseId}
            JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
            WHERE ${chapters.courseId} = ${courseId}
              AND ${lessons.type} = 'quiz'
              AND ${studentLessonProgress.completedAt} IS NOT NULL
              AND ${studentLessonProgress.quizScore} IS NOT NULL
              AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
              AND ${conditions.length ? sql`${and(...conditions)}` : true}
            GROUP BY ${lessons.id}, ${lessons.title}, ${lessons.displayOrder}, ${
              courses.availableLocales
            }, ${courses.baseLanguage}
          ) AS subquery
        ),
        '[]'::jsonb
      )`,
      })
      .from(studentLessonProgress)
      .leftJoin(chapters, eq(studentLessonProgress.chapterId, chapters.id))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .leftJoin(studentCourses, eq(courses.id, studentCourses.courseId))
      .where(and(eq(courses.id, courseId)));

    return averageScorePerQuiz;
  }

  private async getStatisticsConditions(
    query: CourseStatisticsQueryBody,
    source: AnyPgColumn = studentCourses.studentId,
  ) {
    const conditions = [];

    if (query.groupId) {
      const availableIds = await this.getUserIdsByGroup(query.groupId);

      if (availableIds.length > 0) {
        conditions.push(inArray(source, availableIds));
      }
    }

    return conditions;
  }

  private async getUserIdsByGroup(groupId?: UUIDType) {
    if (!groupId) return [];
    return (await this.learningTimeRepository.getStudentsByGroup(groupId)).map(({ id }) => id);
  }

  async getStudentsProgress(query: CourseStudentProgressionQuery) {
    const {
      courseId,
      sort = CourseStudentProgressionSortFields.studentName,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      searchQuery = "",
      language,
      groupId,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastCompletedLessonName,
    } = await this.getStudentCourseStatisticsExpressions(courseId, language);

    const conditions = [
      eq(studentCourses.courseId, courseId),
      this.getSearchQueryConditions(searchQuery),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
    ];

    conditions.push(...(await this.getStatisticsConditions({ groupId })));

    const studentsProgress = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        groups: groupNameExpression,
        completedLessonsCount: completedLessonsCountExpression,
        lastActivity: lastActivityExpression,
        lastCompletedLessonName: lastCompletedLessonName,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...conditions))
      .limit(perPage)
      .offset((page - 1) * perPage)
      .groupBy(users.id)
      .orderBy(
        sortOrder(
          await this.getCourseStatisticsColumnToSortBy(
            sortedField as CourseStudentProgressionSortField,
            courseId,
            language,
          ),
        ),
      );

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...conditions));

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
      language,
      searchQuery = "",
      groupId,
    } = query;

    const { lastAttemptExpression, studentNameExpression, quizNameExpression } =
      await this.getStudentCourseStatisticsExpressions(courseId, language);

    const conditions = [
      eq(studentCourses.courseId, courseId),
      isNotNull(studentLessonProgress.completedAt),
      isNotNull(studentLessonProgress.attempts),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
      or(
        sql`${quizNameExpression} ILIKE ${`%${searchQuery}%`}`,
        this.getSearchQueryConditions(searchQuery),
      ),
    ];

    if (quizId) conditions.push(eq(lessons.id, quizId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const order = sortOrder(
      await this.getCourseStatisticsColumnToSortBy(
        sortedField as CourseStudentQuizResultsSortField,
        courseId,
        language,
      ),
    );

    conditions.push(...(await this.getStatisticsConditions({ groupId })));

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
      .leftJoin(groupUsers, eq(groupUsers.userId, studentLessonProgress.studentId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions))
      .orderBy(order)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentLessonProgress)
      .leftJoin(studentCourses, eq(studentLessonProgress.studentId, studentCourses.studentId))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, studentLessonProgress.studentId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
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
      searchQuery = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
      language,
      groupId,
    } = query;

    const lessonNameExpression = this.localizationService.getLocalizedSqlField(
      lessons.title,
      language,
    );

    const conditions = [
      eq(studentCourses.courseId, courseId),
      eq(lessons.type, LESSON_TYPES.AI_MENTOR),
      eq(studentLessonProgress.id, aiMentorStudentLessonProgress.studentLessonProgressId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
      or(
        this.getSearchQueryConditions(searchQuery),
        sql`${lessonNameExpression} ILIKE ${`%${searchQuery}%`}`,
      ),
    ];

    if (lessonId) conditions.push(eq(lessons.id, lessonId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const { studentNameExpression } = await this.getStudentCourseStatisticsExpressions(
      courseId,
      language,
    );

    const order = sortOrder(
      await this.getCourseStatisticsColumnToSortBy(
        sortedField as CourseStudentAiMentorResultsSortField,
        courseId,
        language,
      ),
    );

    conditions.push(...(await this.getStatisticsConditions({ groupId })));

    const quizResults = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        lessonName: lessonNameExpression,
        score: sql<number>`${aiMentorStudentLessonProgress.percentage}`,
        lastSession: sql<string>`TO_CHAR(${aiMentorStudentLessonProgress.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .leftJoin(studentLessonProgress, eq(studentLessonProgress.studentId, users.id))
      .leftJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .orderBy(order)
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
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
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

  private async getCourseStatisticsColumnToSortBy(
    sort:
      | CourseStudentProgressionSortField
      | CourseStudentQuizResultsSortField
      | CourseStudentAiMentorResultsSortField,
    courseId: UUIDType,
    language: SupportedLanguages,
  ) {
    const {
      lastAttemptExpression,
      studentNameExpression,
      quizNameExpression,
      groupNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      lastCompletedLessonName,
    } = await this.getStudentCourseStatisticsExpressions(courseId, language);

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
        return this.localizationService.getLocalizedSqlField(lessons.title, language);
      case CourseStudentAiMentorResultsSortFields.score:
        return aiMentorStudentLessonProgress.percentage;
      case CourseStudentAiMentorResultsSortFields.lastSession:
        return aiMentorStudentLessonProgress.updatedAt;
      case CourseStudentAiMentorResultsSortFields.lastCompletedLessonName:
        return lastCompletedLessonName;
      default:
        return studentNameExpression;
    }
  }

  private async getStudentCourseStatisticsExpressions(
    courseId: UUIDType,
    language: SupportedLanguages,
  ) {
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

    const groupNameExpression = sql<Array<{ id: string; name: string }>>`(
          SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
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
          SELECT ${this.localizationService.getLocalizedSqlField(
            lessons.title,
            language,
            courses,
            "c",
          )}
          FROM ${lessons}
          JOIN ${chapters} ch ON ch.id = lessons.chapter_id
          JOIN ${courses} c ON c.id = ch.course_id
          WHERE lessons.id = ${studentLessonProgress.lessonId}
            AND lessons.type = 'quiz'
        )`;

    const lastCompletedLessonName = sql<string>`(
          SELECT ${this.localizationService.getLocalizedSqlField(
            lessons.title,
            language,
            courses,
            "c",
          )}
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} ON slp.lesson_id = lessons.id
          JOIN ${chapters} ch ON lessons.chapter_id = ch.id
          JOIN ${courses} c ON c.id = ch.course_id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courseId}
            AND slp.completed_at IS NOT NULL
          ORDER BY slp.completed_at DESC
          LIMIT 1
        )`;

    return {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastAttemptExpression,
      quizNameExpression,
      lastCompletedLessonName,
    };
  }

  async getCourseEmailData(courseId: UUIDType, language?: SupportedLanguages) {
    const [courseData] = await this.db
      .select({
        courseName: this.localizationService.getLocalizedSqlField(courses.title, language),
        hasCertificate: courses.hasCertificate,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return courseData;
  }

  private async buildCourseActivitySnapshot(
    courseId: UUIDType,
    language?: SupportedLanguages,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<CourseActivityLogSnapshot> {
    const {
      language: resolvedLanguage,
      baseLanguage,
      availableLocales,
    } = await this.localizationService.getBaseLanguage(ENTITY_TYPE.COURSE, courseId, language);

    const [course] = await dbInstance
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, resolvedLanguage),
        description: this.localizationService.getLocalizedSqlField(
          courses.description,
          resolvedLanguage,
        ),
        status: courses.status,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasCertificate: courses.hasCertificate,
        isScorm: courses.isScorm,
        categoryId: courses.categoryId,
        authorId: courses.authorId,
        thumbnailS3Key: courses.thumbnailS3Key,
        settings: courses.settings,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) throw new NotFoundException("Course not found");

    return {
      ...course,
      baseLanguage,
      availableLocales: Array.isArray(availableLocales) ? availableLocales : [availableLocales],
    };
  }

  async getChapterName(chapterId: UUIDType, language?: SupportedLanguages) {
    const [{ chapterName }] = await this.db
      .select({
        chapterName: this.localizationService.getLocalizedSqlField(chapters.title, language),
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.id, chapterId));

    return chapterName;
  }

  async getStudentsWithoutCertificate(courseId: UUIDType) {
    return this.db
      .select({ ...getTableColumns(studentCourses) })
      .from(studentCourses)
      .leftJoin(
        certificates,
        and(
          eq(certificates.courseId, studentCourses.courseId),
          eq(certificates.userId, studentCourses.studentId),
        ),
      )
      .where(
        and(
          isNotNull(studentCourses.completedAt),
          isNull(certificates.userId),
          eq(studentCourses.courseId, courseId),
        ),
      );
  }

  async createLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    userId: UUIDType,
    role: UserRole,
  ) {
    await this.adminLessonService.validateAccess("course", role, userId, courseId);

    const [{ availableLocales }] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId));

    if (availableLocales.includes(language)) {
      throw new BadRequestException("adminCourseView.createLanguage.alreadyExists");
    }

    const newLanguages = [...availableLocales, language];

    await this.db
      .update(courses)
      .set({ availableLocales: newLanguages })
      .where(eq(courses.id, courseId));
  }

  async deleteLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    role: UserRole,
    userId: UUIDType,
  ) {
    const { baseLanguage, availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    if (!availableLocales.includes(language) || baseLanguage === language) {
      throw new BadRequestException({ message: "adminCourseView.toast.invalidLanguageToDelete" });
    }

    const data = await this.getBetaCourseById(courseId, language, userId, role);

    return this.db.transaction(async (trx) => {
      const chapterIds = data.chapters.map(({ id }) => id);
      const lessonIds: UUIDType[] = [];
      const questionIds: UUIDType[] = [];

      for (const chapter of data.chapters) {
        for (const lesson of chapter.lessons ?? []) {
          lessonIds.push(lesson.id);
          if (lesson.type === LESSON_TYPES.QUIZ && lesson.questions) {
            for (const q of lesson.questions) if (q.id) questionIds.push(q.id);
          }
        }
      }

      if (chapterIds.length) {
        await trx
          .update(chapters)
          .set({ title: deleteJsonbField(chapters.title, language) })
          .where(inArray(chapters.id, chapterIds));
      }

      if (lessonIds.length) {
        await trx
          .update(lessons)
          .set({
            title: deleteJsonbField(lessons.title, language),
            description: deleteJsonbField(lessons.description, language),
          })
          .where(inArray(lessons.id, lessonIds));
      }

      if (questionIds.length) {
        await trx
          .update(questions)
          .set({
            title: deleteJsonbField(questions.title, language),
            description: deleteJsonbField(questions.description, language),
            solutionExplanation: deleteJsonbField(questions.solutionExplanation, language),
          })
          .where(inArray(questions.id, questionIds));

        await trx
          .update(questionAnswerOptions)
          .set({
            optionText: deleteJsonbField(questionAnswerOptions.optionText, language),
            matchedWord: deleteJsonbField(questionAnswerOptions.matchedWord, language),
          })
          .where(inArray(questionAnswerOptions.questionId, questionIds));
      }

      await trx
        .update(courses)
        .set({
          title: deleteJsonbField(courses.title, language),
          description: deleteJsonbField(courses.description, language),
          availableLocales: sql`ARRAY_REMOVE(${courses.availableLocales}, ${language})`,
        })
        .where(eq(courses.id, courseId));
    });
  }

  async getStudentsDueDatesForCourse(
    courseId: UUIDType,
    studentIds: UUIDType[],
  ): Promise<Record<string, string | null>> {
    if (!studentIds.length) return {};
    const rows = await this.db
      .select({
        studentId: studentCourses.studentId,
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'DD.MM.YYYY')`,
      })
      .from(studentCourses)
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, studentCourses.courseId),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, studentIds)),
      );

    return rows.reduce(
      (acc, row) => {
        acc[row.studentId] = row.dueDate;
        return acc;
      },
      {} as Record<string, string | null>,
    );
  }

  async sendOverdueCoursesEmails() {
    const overdueStudents = await this.db
      .select({
        courseId: courses.id,
        courseTitle: this.localizationService.getLocalizedSqlField(
          courses.title,
          SUPPORTED_LANGUAGES.EN,
        ),
        studentId: users.id,
        studentName: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        studentEmail: users.email,
        groupId: groups.id,
        groupName: groups.name,
        dueDate: sql<string>`TO_CHAR(${groupCourses.dueDate}, 'DD.MM.YYYY')`,
      })
      .from(groupCourses)
      .innerJoin(courses, eq(courses.id, groupCourses.courseId))
      .innerJoin(groups, eq(groups.id, groupCourses.groupId))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, courses.id),
          or(
            eq(studentCourses.enrolledByGroupId, groups.id),
            and(
              eq(groupCourses.isMandatory, true),
              sql`EXISTS (
                SELECT 1
                FROM ${groupUsers}
                WHERE ${groupUsers.groupId} = ${groups.id}
                  AND ${groupUsers.userId} = ${studentCourses.studentId}
                  AND ${studentCourses.enrolledByGroupId} IS NULL
              )`,
            ),
          ),
        ),
      )
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          isNotNull(groupCourses.dueDate),
          sql`${groupCourses.dueDate} < NOW()`,
          eq(users.role, USER_ROLES.STUDENT),
          isNull(users.deletedAt),
          isNull(studentCourses.completedAt),
        ),
      );

    if (overdueStudents.length === 0) return;

    const groupedByCourse = overdueStudents.reduce(
      (acc, row) => {
        const courseTitle = row.courseTitle;
        if (!acc[courseTitle as string]) acc[courseTitle as string] = [];
        acc[courseTitle as string].push(row);
        return acc;
      },
      {} as Record<string, typeof overdueStudents>,
    );

    const adminsToNotify = await this.userService.getAdminsToNotifyAboutOverdueCourse();

    if (adminsToNotify.length === 0) return;

    const indent = "\u00A0\u00A0\u00A0\u00A0";

    await Promise.all(
      adminsToNotify.map(async ({ id: adminId, email: adminEmail }) => {
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(adminId);

        const lines: string[] = [];
        for (const [courseKey, rows] of Object.entries(groupedByCourse)) {
          lines.push(`Course: ${courseKey}`);
          lines.push("");

          rows.forEach((r) => {
            lines.push(`${indent}- ${r.studentName} (${r.studentEmail})`);
            lines.push("");
          });

          const uniqueDueDates = Array.from(new Set(rows.map((r) => r.dueDate).filter(Boolean)));
          lines.push(
            `${indent}Due date: ${uniqueDueDates.length ? uniqueDueDates.join(", ") : "-"}`,
          );
          lines.push("");
        }

        const heading =
          defaultEmailSettings.language === "pl"
            ? "Zaległe kursy studentów"
            : "Students with overdue courses";
        const introParagraph =
          defaultEmailSettings.language === "pl"
            ? "Niektórzy studenci nie ukończyli kursów w wymaganym terminie:"
            : "Some students did not finish their courses on time:";
        const buttonText =
          defaultEmailSettings.language === "pl" ? "PRZEJDŹ DO KURSÓW" : "VIEW COURSES";

        const { text, html } = new BaseEmailTemplate({
          heading,
          paragraphs: [introParagraph, "", ...lines],
          buttonText,
          buttonLink: `${process.env.CORS_ORIGIN}/admin/courses`,
          ...defaultEmailSettings,
        });

        return this.emailService.sendEmailWithLogo({
          to: adminEmail,
          subject: "Overdue courses notification",
          text,
          html,
        });
      }),
    );
  }

  async generateMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ) {
    const { baseLanguage, availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    if (!availableLocales.includes(language) || baseLanguage === language) {
      throw new BadRequestException({ message: "adminCourseView.toast.languageNotSupported" });
    }

    const courseInRequestedLanguage = await this.getBetaCourseById(
      courseId,
      language,
      currentUser.userId,
      currentUser.role,
    );

    const courseInBaseLanguage = await this.getBetaCourseById(
      courseId,
      baseLanguage,
      currentUser.userId,
      currentUser.role,
    );

    const { flat: missingData, withContext } = this.collectMissingTranslationFieldsWithContext(
      courseId,
      courseInRequestedLanguage,
      courseInBaseLanguage,
    );

    if (!missingData.length) {
      throw new BadRequestException({ message: "adminCourseView.toast.noMissingTranslations" });
    }

    return this.db.transaction(async (trx) => {
      const translations = await this.aiService.generateMissingTranslations(
        withContext,
        language,
        courseId,
      );

      const flat = translations.flat(1);

      if (missingData.length !== flat.length) {
        throw new BadRequestException(`adminCourseView.toast.mismatchContentLength`);
      }

      for (let i = 0; i < flat.length; i++) {
        const translatedValue = flat[i];
        const currData = missingData[i];

        await trx
          .update(currData.field.table)
          .set({
            [camelCase(currData.field.name)]: setJsonbField(
              currData.field,
              language,
              translatedValue,
            ),
          })
          .where(eq(currData.idColumn, currData.id));
      }
    });
  }

  private *translationCandidates(
    courseId: UUIDType,
    course: Awaited<ReturnType<typeof this.getBetaCourseById>>,
    baseCourse?: Awaited<ReturnType<typeof this.getBetaCourseById>>,
  ): Generator<{
    id: string | undefined;
    hasValue: boolean;
    baseValue: string | null | undefined;
    field: AnyPgColumn;
    idColumn: AnyPgColumn;
  }> {
    yield {
      id: courseId,
      hasValue: Boolean(course.title?.length),
      baseValue: baseCourse?.title,
      field: courses.title,
      idColumn: courses.id,
    };

    yield {
      id: courseId,
      hasValue: Boolean(course.description?.length),
      baseValue: baseCourse?.description,
      field: courses.description,
      idColumn: courses.id,
    };

    const baseChapterMap = new Map((baseCourse?.chapters ?? []).map((ch) => [ch.id, ch]));

    for (const chapter of course.chapters) {
      const baseChapter = baseChapterMap.get(chapter.id);

      yield {
        id: chapter.id,
        hasValue: Boolean(chapter.title?.length),
        baseValue: baseChapter?.title,
        field: chapters.title,
        idColumn: chapters.id,
      };

      const baseLessonMap = new Map(
        (baseChapter?.lessons ?? []).map((lesson) => [lesson.id, lesson]),
      );

      for (const lesson of chapter.lessons ?? []) {
        const baseLesson = baseLessonMap.get(lesson.id);

        yield {
          id: lesson.id,
          hasValue: Boolean(lesson.title?.length),
          baseValue: baseLesson?.title,
          field: lessons.title,
          idColumn: lessons.id,
        };

        yield {
          id: lesson.id,
          hasValue: Boolean(lesson.description?.length),
          baseValue: baseLesson?.description,
          field: lessons.description,
          idColumn: lessons.id,
        };

        if (lesson.type !== LESSON_TYPES.QUIZ || !lesson.questions?.length) continue;

        const baseQuestionMap = new Map(
          (baseLesson?.questions ?? []).map((question) => [question.id, question]),
        );

        for (const question of lesson.questions) {
          const baseQuestion = baseQuestionMap.get(question.id);

          yield {
            id: question.id,
            hasValue: Boolean(question.title?.length),
            baseValue: baseQuestion?.title,
            field: questions.title,
            idColumn: questions.id,
          };

          yield {
            id: question.id,
            hasValue: Boolean(question.description?.length),
            baseValue: baseQuestion?.description,
            field: questions.description,
            idColumn: questions.id,
          };

          yield {
            id: question.id,
            hasValue: Boolean(question.solutionExplanation?.length),
            baseValue: baseQuestion?.solutionExplanation,
            field: questions.solutionExplanation,
            idColumn: questions.id,
          };

          const baseOptionMap = new Map(
            (baseQuestion?.options ?? []).map((option) => [option.id, option]),
          );

          for (const option of question.options ?? []) {
            const baseOption = baseOptionMap.get(option.id);

            yield {
              id: option.id,
              hasValue: Boolean(option.optionText?.length),
              baseValue: baseOption?.optionText,
              field: questionAnswerOptions.optionText,
              idColumn: questionAnswerOptions.id,
            };

            yield {
              id: option.id,
              hasValue: Boolean(option.matchedWord?.length),
              baseValue: baseOption?.matchedWord,
              field: questionAnswerOptions.matchedWord,
              idColumn: questionAnswerOptions.id,
            };
          }
        }
      }
    }
  }

  private collectMissingTranslationFields(
    courseId: UUIDType,
    course: Awaited<ReturnType<typeof this.getBetaCourseById>>,
    baseCourse?: Awaited<ReturnType<typeof this.getBetaCourseById>>,
    earlyReturn = false,
  ): CourseTranslationType[] {
    const dataToUpdate: CourseTranslationType[] = [];
    type Candidate =
      ReturnType<typeof this.translationCandidates> extends Generator<infer T> ? T : never;

    const pushMissing = ({ id, hasValue, baseValue, field, idColumn }: Candidate) => {
      if (hasValue || !id) return false;
      const base = typeof baseValue === "string" ? baseValue : undefined;
      if (!base?.length) return false;

      dataToUpdate.push({ id, base, field, idColumn });
      return true;
    };

    for (const candidate of this.translationCandidates(courseId, course, baseCourse)) {
      const added = pushMissing(candidate);
      if (earlyReturn && added) break;
    }

    return dataToUpdate;
  }

  private collectMissingTranslationFieldsWithContext(
    courseId: UUIDType,
    course: Awaited<ReturnType<typeof this.getBetaCourseById>>,
    baseCourse?: Awaited<ReturnType<typeof this.getBetaCourseById>>,
  ): {
    flat: CourseTranslationType[];
    grouped: {
      course: CourseTranslationType[];
      chapters: Array<{
        chapterId: UUIDType;
        chapterTitle?: string;
        fields: CourseTranslationType[];
        lessons: Array<{
          lessonId: UUIDType;
          lessonTitle?: string;
          lessonDescription?: string;
          fields: CourseTranslationType[];
          questions: Array<{
            questionId: UUIDType;
            questionTitle?: string;
            questionDescription?: string;
            fields: CourseTranslationType[];
            options: Array<{
              optionId: UUIDType;
              optionText?: string;
              fields: CourseTranslationType[];
            }>;
          }>;
        }>;
      }>;
    };
    withContext: Array<{
      data: CourseTranslationType;
      metadata: string;
      context: {
        courseTitle?: string;
        chapterTitle?: string;
        lessonTitle?: string;
        lessonDescription?: string;
        questionTitle?: string;
        questionDescription?: string;
        questionOptions?: string;
        optionText?: string;
      };
    }>;
  } {
    const flat = this.collectMissingTranslationFields(courseId, course, baseCourse);
    const grouped = {
      course: [] as CourseTranslationType[],
      chapters: [] as Array<{
        chapterId: UUIDType;
        chapterTitle?: string;
        fields: CourseTranslationType[];
        lessons: Array<{
          lessonId: UUIDType;
          lessonTitle?: string;
          lessonDescription?: string;
          fields: CourseTranslationType[];
          questions: Array<{
            questionId: UUIDType;
            questionTitle?: string;
            questionDescription?: string;
            fields: CourseTranslationType[];
            options: Array<{
              optionId: UUIDType;
              optionText?: string;
              fields: CourseTranslationType[];
            }>;
          }>;
        }>;
      }>,
    };

    const courseTitle = baseCourse?.title;

    const chapterById = new Map<UUIDType, { chapterId: UUIDType; chapterTitle?: string }>();
    const lessonById = new Map<
      UUIDType,
      {
        chapterId: UUIDType;
        lessonId: UUIDType;
        lessonTitle?: string;
        lessonDescription?: string;
      }
    >();
    const questionById = new Map<
      UUIDType,
      {
        chapterId: UUIDType;
        lessonId: UUIDType;
        questionId: UUIDType;
        questionTitle?: string;
        questionDescription?: string;
        questionOptions?: string;
      }
    >();
    const optionsByQuestionId = new Map<
      UUIDType,
      Array<{ optionText?: string; matchedWord?: string | null }>
    >();
    const optionById = new Map<
      UUIDType,
      {
        chapterId: UUIDType;
        lessonId: UUIDType;
        questionId: UUIDType;
        optionId: UUIDType;
        optionText?: string;
      }
    >();

    for (const chapter of baseCourse?.chapters ?? []) {
      chapterById.set(chapter.id, { chapterId: chapter.id, chapterTitle: chapter.title });
      for (const lesson of chapter.lessons ?? []) {
        lessonById.set(lesson.id, {
          chapterId: chapter.id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonDescription: lesson.description ?? undefined,
        });

        for (const question of lesson.questions ?? []) {
          if (!question.id) continue;
          const opts = question.options ?? [];
          optionsByQuestionId.set(
            question.id,
            opts.map((o) => ({
              optionText: o.optionText ?? undefined,
              matchedWord: o.matchedWord ?? undefined,
            })),
          );
          const questionOptions = opts
            .map((o) => {
              const text = o.optionText ?? "";
              const matched = o.matchedWord ?? "";
              if (text && matched) return `- ${text} (matchedWord: ${matched})`;
              if (text) return `- ${text}`;
              if (matched) return `- (matchedWord: ${matched})`;
              return "";
            })
            .filter(Boolean)
            .join("\n");
          questionById.set(question.id, {
            chapterId: chapter.id,
            lessonId: lesson.id,
            questionId: question.id,
            questionTitle: question.title,
            questionDescription: question.description ?? undefined,
            questionOptions: questionOptions || undefined,
          });

          for (const option of question.options ?? []) {
            if (!option.id) continue;
            optionById.set(option.id, {
              chapterId: chapter.id,
              lessonId: lesson.id,
              questionId: question.id,
              optionId: option.id,
              optionText: option.optionText ?? undefined,
            });
          }
        }
      }
    }

    const getOrCreateChapterGroup = (chapterId: UUIDType) => {
      let ch = grouped.chapters.find((c) => c.chapterId === chapterId);
      if (!ch) {
        const base = chapterById.get(chapterId);
        ch = {
          chapterId,
          chapterTitle: base?.chapterTitle,
          fields: [],
          lessons: [],
        };
        grouped.chapters.push(ch);
      }
      return ch;
    };

    const getOrCreateLessonGroup = (chapterId: UUIDType, lessonId: UUIDType) => {
      const ch = getOrCreateChapterGroup(chapterId);
      let ls = ch.lessons.find((l) => l.lessonId === lessonId);
      if (!ls) {
        const base = lessonById.get(lessonId);
        ls = {
          lessonId,
          lessonTitle: base?.lessonTitle,
          lessonDescription: base?.lessonDescription,
          fields: [],
          questions: [],
        };
        ch.lessons.push(ls);
      }
      return ls;
    };

    const getOrCreateQuestionGroup = (
      chapterId: UUIDType,
      lessonId: UUIDType,
      questionId: UUIDType,
    ) => {
      const ls = getOrCreateLessonGroup(chapterId, lessonId);
      let qg = ls.questions.find((q) => q.questionId === questionId);
      if (!qg) {
        const base = questionById.get(questionId);
        qg = {
          questionId,
          questionTitle: base?.questionTitle,
          questionDescription: base?.questionDescription,
          fields: [],
          options: [],
        };
        ls.questions.push(qg);
      }
      return qg;
    };

    const getOrCreateOptionGroup = (
      chapterId: UUIDType,
      lessonId: UUIDType,
      questionId: UUIDType,
      optionId: UUIDType,
    ) => {
      const qg = getOrCreateQuestionGroup(chapterId, lessonId, questionId);
      let og = qg.options.find((o) => o.optionId === optionId);
      if (!og) {
        const base = optionById.get(optionId);
        og = { optionId, optionText: base?.optionText, fields: [] };
        qg.options.push(og);
      }
      return og;
    };

    const withContext = flat.map((entry) => {
      const metadata = `${entry.field.name}`;

      if (entry.field.table === courses) {
        grouped.course.push(entry);
        return {
          data: entry,
          metadata,
          context: { courseTitle },
        };
      }

      if (entry.field.table === chapters) {
        const base = chapterById.get(entry.id as UUIDType);
        if (base) getOrCreateChapterGroup(base.chapterId).fields.push(entry);
        return {
          data: entry,
          metadata,
          context: {
            courseTitle,
            chapterTitle: base?.chapterTitle,
          },
        };
      }

      if (entry.field.table === lessons) {
        const base = lessonById.get(entry.id as UUIDType);
        if (base) getOrCreateLessonGroup(base.chapterId, base.lessonId).fields.push(entry);
        return {
          data: entry,
          metadata,
          context: {
            courseTitle,
            chapterTitle: base ? chapterById.get(base.chapterId)?.chapterTitle : undefined,
            lessonTitle: base?.lessonTitle,
            lessonDescription: base?.lessonDescription,
          },
        };
      }

      if (entry.field.table === questions) {
        const base = questionById.get(entry.id as UUIDType);
        if (base)
          getOrCreateQuestionGroup(base.chapterId, base.lessonId, base.questionId).fields.push(
            entry,
          );
        return {
          data: entry,
          metadata,
          context: {
            courseTitle,
            chapterTitle: base ? chapterById.get(base.chapterId)?.chapterTitle : undefined,
            lessonTitle: base ? lessonById.get(base.lessonId)?.lessonTitle : undefined,
            lessonDescription: base ? lessonById.get(base.lessonId)?.lessonDescription : undefined,
            questionTitle: base?.questionTitle,
            questionDescription: base?.questionDescription,
            questionOptions: base?.questionOptions,
          },
        };
      }

      if (entry.field.table === questionAnswerOptions) {
        const base = optionById.get(entry.id as UUIDType);
        if (base)
          getOrCreateOptionGroup(
            base.chapterId,
            base.lessonId,
            base.questionId,
            base.optionId,
          ).fields.push(entry);
        const questionBase = base ? questionById.get(base.questionId) : undefined;
        const lessonBase = base ? lessonById.get(base.lessonId) : undefined;
        return {
          data: entry,
          metadata,
          context: {
            courseTitle,
            chapterTitle: base ? chapterById.get(base.chapterId)?.chapterTitle : undefined,
            lessonTitle: lessonBase?.lessonTitle,
            lessonDescription: lessonBase?.lessonDescription,
            questionTitle: questionBase?.questionTitle,
            questionDescription: questionBase?.questionDescription,
            optionText: base?.optionText,
          },
        };
      }

      return {
        data: entry,
        metadata,
        context: { courseTitle },
      };
    });

    return { flat, grouped, withContext };
  }

  private getSearchQueryConditions(searchQuery: string) {
    return or(
      ilike(users.firstName, `%${searchQuery}%`),
      ilike(users.lastName, `%${searchQuery}%`),
      ilike(groups.name, `%${searchQuery}%`),
    );
  }
}
