import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
  sql,
} from "drizzle-orm";
import { isEmpty } from "lodash";

import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg } from "src/common";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { getSortOptions } from "../common/helpers/getSortOptions";
import {
  categories,
  chapters,
  courses,
  coursesSummaryStats,
  lessons,
  questions,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  studentQuestionAnswers,
  users,
} from "../storage/schema";

import {
  COURSE_ENROLLMENT_SCOPES,
  type CourseEnrollmentScope,
  type CoursesFilterSchema,
  type CourseSortField,
  CourseSortFields,
  type CoursesQuery,
} from "./schemas/courseQuery";

import type {
  AllCoursesForTeacherResponse,
  AllCoursesResponse,
  AllStudentCoursesResponse,
} from "./schemas/course.schema";
import type { CreateCourseBody } from "./schemas/createCourse.schema";
import type { CommonShowCourse } from "./schemas/showCourseCommon.schema";
import type { UpdateCourseBody } from "./schemas/updateCourse.schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Pagination, UUIDType } from "src/common";
import type {
  AdminLessonWithContentSchema,
  LessonForChapterSchema,
} from "src/lesson/lesson.schema";
import type * as schema from "src/storage/schema";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class CourseService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly fileService: FileService,
    private readonly lessonRepository: LessonRepository,
    private readonly statisticsRepository: StatisticsRepository,
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

    if (currentUserRole === USER_ROLES.TEACHER && currentUserId) {
      conditions.push(eq(courses.authorId, currentUserId));
    }

    const queryDB = this.db
      .select({
        id: courses.id,
        title: courses.title,
        description: sql<string>`${courses.description}`,
        thumbnailUrl: courses.thumbnailS3Key,
        author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        category: sql<string>`${categories.title}`,
        enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
        courseChapterCount: courses.chapterCount,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        isPublished: courses.isPublished,
        createdAt: courses.createdAt,
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
        categories.title,
        courses.priceInCents,
        courses.currency,
        courses.isPublished,
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
          return { ...item, thumbnailUrl: signedUrl };
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
      const conditions = [eq(studentCourses.studentId, userId), eq(courses.isPublished, true)];
      conditions.push(...this.getFiltersConditions(filters));

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
            return { ...item, thumbnailUrl: signedUrl };
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

      const conditions = [eq(courses.isPublished, true)];
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
            const signedUrl = await this.fileService.getFileUrl(item.thumbnailUrl);

            return { ...item, thumbnailUrl: signedUrl };
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
        isPublished: courses.isPublished,
        isScorm: courses.isScorm,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        authorId: courses.authorId,
        hasFreeChapter: sql<boolean>`
          EXISTS (
            SELECT 1
            FROM ${chapters}
            WHERE ${chapters.courseId} = ${courses.id}
              AND ${chapters.isFreemium} = TRUE
          )`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(courses.id, id));

    if (!course) throw new NotFoundException("Course not found");

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
            WHEN ${studentChapterProgress.completedAt} IS NULL
              AND ${studentChapterProgress.completedLessonCount} > 0 THEN ${PROGRESS_STATUSES.IN_PROGRESS}
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
                    WHEN ${studentLessonProgress.completedAt} IS NOT NULL THEN  ${PROGRESS_STATUSES.COMPLETED}
                    WHEN ${studentLessonProgress.completedAt} IS NULL
                      AND ${studentLessonProgress.completedQuestionCount} > 0 THEN  ${PROGRESS_STATUSES.IN_PROGRESS}
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
                  ${studentLessonProgress.completedQuestionCount}
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

  async getBetaCourseById(id: UUIDType) {
    const [course] = await this.db
      .select({
        id: courses.id,
        title: courses.title,
        thumbnailS3Key: sql<string>`COALESCE(${courses.thumbnailS3Key}, '')`,
        category: categories.title,
        categoryId: categories.id,
        description: sql<string>`${courses.description}`,
        courseChapterCount: courses.chapterCount,
        isPublished: courses.isPublished,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
      })
      .from(courses)
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

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

  async getTeacherCourses({
    currentUserId,
    authorId,
    scope,
    excludeCourseId,
  }: {
    currentUserId: UUIDType;
    authorId: UUIDType;
    scope: CourseEnrollmentScope;
    excludeCourseId?: UUIDType;
  }): Promise<AllCoursesForTeacherResponse> {
    const conditions = [eq(courses.isPublished, true), eq(courses.authorId, authorId)];

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

    const teacherCourses = await this.db
      .select({
        id: courses.id,
        description: sql<string>`${courses.description}`,
        title: courses.title,
        thumbnailUrl: courses.thumbnailS3Key,
        authorId: sql<string>`${courses.authorId}`,
        author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
        authorEmail: sql<string>`${users.email}`,
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
        studentCourses.studentId,
        categories.title,
      )
      .orderBy(
        sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NULL THEN TRUE ELSE FALSE END`,
        courses.title,
      );

    return await Promise.all(
      teacherCourses.map(async (course) => ({
        ...course,
        thumbnailUrl: course.thumbnailUrl
          ? await this.fileService.getFileUrl(course.thumbnailUrl)
          : course.thumbnailUrl,
      })),
    );
  }

  async createCourse(createCourseBody: CreateCourseBody, authorId: UUIDType) {
    return this.db.transaction(async (trx) => {
      const [category] = await trx
        .select()
        .from(categories)
        .where(eq(categories.id, createCourseBody.categoryId));

      if (!category) {
        throw new NotFoundException("Category not found");
      }

      const [newCourse] = await trx
        .insert(courses)
        .values({
          title: createCourseBody.title,
          description: createCourseBody.description,
          thumbnailS3Key: createCourseBody.thumbnailS3Key,
          isPublished: createCourseBody.isPublished,
          priceInCents: createCourseBody.priceInCents,
          currency: createCourseBody.currency || "usd",
          isScorm: createCourseBody.isScorm,
          authorId,
          categoryId: createCourseBody.categoryId,
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
    image?: Express.Multer.File,
    currentUserId?: UUIDType,
  ) {
    return this.db.transaction(async (trx) => {
      const [existingCourse] = await trx.select().from(courses).where(eq(courses.id, id));

      if (!existingCourse) {
        throw new NotFoundException("Course not found");
      }

      if (existingCourse.authorId !== currentUserId) {
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

      const updateData = {
        ...updateCourseBody,
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

      return updatedCourse;
    });
  }

  async enrollCourse(id: UUIDType, studentId: UUIDType, testKey?: string) {
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

    /*
      For Playwright tests to bypass Stripe payment
      Front-end interfaces, such as Stripe Checkout or the Payment Element, have security measures in place that prevent automated testing, and Stripe APIs are rate limited.
   */
    const isTest = testKey && testKey === process.env.TEST_KEY;
    if (!isTest && Boolean(course.price)) throw new ForbiddenException();

    await this.createCourseDependencies(id, studentId);
  }

  async createCourseDependencies(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
  ) {
    const [enrolledCourse] = await this.db
      .insert(studentCourses)
      .values({ studentId, courseId, paymentId })
      .returning();

    if (!enrolledCourse) throw new ConflictException("Course not enrolled");

    await this.db.transaction(async (trx) => {
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
    if (filters.isPublished) {
      conditions.push(eq(courses.isPublished, filters.isPublished));
    }

    if (publishedOnly) {
      conditions.push(eq(courses.isPublished, true));
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
}
