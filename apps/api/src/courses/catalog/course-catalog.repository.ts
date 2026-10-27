import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  COURSE_LEARNING_STATE_KINDS,
  COURSE_STATUSES,
  PERMISSIONS,
  type SupportedLanguages,
} from "@repo/shared";
import {
  and,
  asc,
  between,
  count,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination } from "src/common/pagination";
import { getGroupManagerCourseScopeCondition } from "src/common/permissions/group-manager-scope.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  categories,
  courseLearningStates,
  courses,
  coursesSummaryStats,
  groupCourses,
  studentCourses,
  users,
} from "src/storage/schema";

import { COURSE_ENROLLMENT_SCOPES, CourseSortFields } from "../schemas/courseQuery";
import { courseAuthorAvatarReferenceSql, courseAuthorNameSql } from "../utils/course-author-sql";
import { localizedLearningOutcomesSql } from "../utils/course-learning-outcomes-sql";
import { studentCourseProgressOrderSql } from "../utils/course-progress-sql";
import {
  courseEnrolledParticipantCountSql,
  courseHasFreeChaptersSql,
  courseLessonCountSql,
} from "../utils/course-summary-sql";

import type {
  AvailableCoursesFilters,
  ContentCreatorCoursesFilters,
  CourseCatalogPageOptions,
  CourseListAccessScope,
  ManagedCoursesFilters,
  StudentCoursesFilters,
  TopCoursesFilters,
} from "./course-catalog.types";
import type { CourseSortField, CoursesFilterSchema } from "../schemas/courseQuery";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

@Injectable()
export class CourseCatalogRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findManagedCourses(
    managedCoursesFilters: ManagedCoursesFilters,
    { page, perPage, sort }: CourseCatalogPageOptions,
  ) {
    const { language } = managedCoursesFilters;
    const { sortOrder, sortedField } = getSortOptions(sort);

    const query = this.db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        thumbnailUrl: courses.thumbnailS3Key,
        author: courseAuthorNameSql(),
        authorAvatarUrl: courseAuthorAvatarReferenceSql(),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        enrolledParticipantCount: courseEnrolledParticipantCountSql(),
        courseChapterCount: courses.chapterCount,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        status: courses.status,
        isArchived: courses.isArchived,
        createdAt: courses.createdAt,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
        originType: courses.originType,
        isContentReadonly: sql<boolean>`${courses.originType} = 'exported'`,
        courseType: courses.courseType,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
      .where(and(...this.buildManagedCoursesConditions(managedCoursesFilters)))
      .groupBy(
        courses.id,
        courses.title,
        courses.description,
        courses.thumbnailS3Key,
        users.firstName,
        users.lastName,
        users.avatarReference,
        categories.title,
        categories.availableLocales,
        categories.baseLanguage,
        courses.priceInCents,
        courses.currency,
        courses.status,
        courses.originType,
        coursesSummaryStats.freePurchasedCount,
        coursesSummaryStats.paidPurchasedCount,
        courses.createdAt,
        courses.availableLocales,
        courses.baseLanguage,
      )
      .orderBy(sortOrder(this.buildCourseSortColumn(sortedField as CourseSortField, language)));

    return addPagination(query.$dynamic(), page, perPage);
  }

  async countManagedCourses(managedCoursesFilters: ManagedCoursesFilters) {
    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(courses.id) })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
      .where(and(...this.buildManagedCoursesConditions(managedCoursesFilters)));

    return totalItems;
  }

  async findStudentCourses(
    studentCoursesFilters: StudentCoursesFilters,
    { page, perPage, sort }: CourseCatalogPageOptions,
    db: DatabasePg,
  ) {
    const { language } = studentCoursesFilters;
    const { sortOrder, sortedField } = getSortOptions(sort);

    const query = db
      .select(this.buildStudentCourseSelection(language))
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
      .where(and(...this.buildStudentCoursesConditions(studentCoursesFilters)))
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
        categories.availableLocales,
        categories.baseLanguage,
        coursesSummaryStats.freePurchasedCount,
        coursesSummaryStats.paidPurchasedCount,
        studentCourses.finishedChapterCount,
        studentCourses.completedAt,
        courses.availableLocales,
        courses.baseLanguage,
        groupCourses.dueDate,
      )
      .orderBy(
        sql`CASE WHEN ${studentCourses.completedAt} IS NULL THEN 0 ELSE 1 END`,
        studentCourseProgressOrderSql(),
        sortOrder(this.buildCourseSortColumn(sortedField as CourseSortField, language)),
      );

    return addPagination(query.$dynamic(), page, perPage);
  }

  async countStudentCourses(studentCoursesFilters: StudentCoursesFilters, db: DatabasePg) {
    const [{ totalItems }] = await db
      .select({ totalItems: countDistinct(courses.id) })
      .from(studentCourses)
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .innerJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .where(and(...this.buildStudentCoursesConditions(studentCoursesFilters)));

    return totalItems;
  }

  /** Courses the user is not enrolled in; empty when there is no user. */
  async findAvailableCourseIds(
    currentUserId: UUIDType | undefined,
    { authorId, excludeCourseId }: { authorId?: UUIDType; excludeCourseId?: UUIDType },
    db: DatabasePg = this.db,
  ) {
    if (!currentUserId) return [];

    const availableCourses = await db
      .select({ courseId: courses.id })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, courses.id),
          eq(studentCourses.studentId, currentUserId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(
        and(
          authorId ? eq(courses.authorId, authorId) : undefined,
          excludeCourseId ? ne(courses.id, excludeCourseId) : undefined,
          isNull(studentCourses.id),
        ),
      );

    return availableCourses.map(({ courseId }) => courseId);
  }

  async findAvailableCourses(
    availableCoursesFilters: AvailableCoursesFilters,
    { page, perPage, sort }: CourseCatalogPageOptions,
    db: DatabasePg,
  ) {
    const { language, currentUserId } = availableCoursesFilters;
    const { sortOrder, sortedField } = getSortOptions(sort);

    const query = db
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        thumbnailUrl: sql<string>`${courses.thumbnailS3Key}`,
        authorId: sql<string>`${courses.authorId}`,
        author: courseAuthorNameSql(),
        authorEmail: sql<string>`${users.email}`,
        authorAvatarUrl: courseAuthorAvatarReferenceSql(),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        enrolled: sql<boolean>`FALSE`,
        enrolledParticipantCount: courseEnrolledParticipantCountSql(),
        courseChapterCount: courses.chapterCount,
        lessonCount: courseLessonCountSql(),
        completedChapterCount: sql<number>`0`,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasFreeChapters: courseHasFreeChaptersSql(),
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        originType: courses.originType,
        isContentReadonly: sql<boolean>`${courses.originType} = 'exported'`,
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
      .where(and(...this.buildAvailableCoursesConditions(availableCoursesFilters)))
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
        categories.availableLocales,
        categories.baseLanguage,
        coursesSummaryStats.freePurchasedCount,
        coursesSummaryStats.paidPurchasedCount,
        courses.availableLocales,
        courses.baseLanguage,
        courses.originType,
        groupCourses.dueDate,
      )
      .orderBy(sortOrder(this.buildCourseSortColumn(sortedField as CourseSortField, language)));

    return addPagination(query.$dynamic(), page, perPage);
  }

  async countAvailableCourses(availableCoursesFilters: AvailableCoursesFilters, db: DatabasePg) {
    const [{ totalItems }] = await db
      .select({ totalItems: countDistinct(courses.id) })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .where(and(...this.buildAvailableCoursesConditions(availableCoursesFilters)));

    return totalItems;
  }

  async findAvailableCourseCategories(
    availableCoursesFilters: AvailableCoursesFilters,
    { page, perPage }: Omit<CourseCatalogPageOptions, "sort">,
    db: DatabasePg,
  ) {
    const { language } = availableCoursesFilters;
    const availableCategories = this.buildAvailableCategoriesSubquery(availableCoursesFilters, db);

    const query = db
      .select({
        ...getTableColumns(categories),
        createdAt: sql<string | null>`NULL`,
        title: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
      })
      .from(categories)
      .innerJoin(availableCategories, eq(availableCategories.categoryId, categories.id))
      .orderBy(
        this.localizationService.getLocalizedSqlField(categories.title, language, categories),
      );

    return addPagination(query.$dynamic(), page, perPage);
  }

  async countAvailableCourseCategories(
    availableCoursesFilters: AvailableCoursesFilters,
    db: DatabasePg,
  ) {
    const availableCategories = this.buildAvailableCategoriesSubquery(availableCoursesFilters, db);

    const [{ totalItems }] = await db.select({ totalItems: count() }).from(availableCategories);

    return totalItems;
  }

  /** Published courses ranked by enrollments since `enrolledSince`, newest first on ties. */
  async findTopCourses(
    { language, enrolledSince, limit, availableCourseIds }: TopCoursesFilters,
    db: DatabasePg,
  ) {
    return db
      .select({
        ...getTableColumns(courses),
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        learningOutcomes: localizedLearningOutcomesSql(language, true),
        thumbnailUrl: sql<string>`${courses.thumbnailS3Key}`,
        author: courseAuthorNameSql(),
        authorEmail: sql<string>`${users.email}`,
        authorAvatarUrl: courseAuthorAvatarReferenceSql(),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        enrolled: sql<boolean>`FALSE`,
        enrolledParticipantCount: courseEnrolledParticipantCountSql(),
        courseChapterCount: courses.chapterCount,
        lessonCount: courseLessonCountSql(),
        completedChapterCount: sql<number>`0`,
        hasFreeChapters: courseHasFreeChaptersSql(),
        dueDate: sql<
          string | null
        >`TO_CHAR(MAX(${groupCourses.dueDate}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, courses.id),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          gte(studentCourses.enrolledAt, enrolledSince),
        ),
      )
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, courses.id),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
      .where(
        and(
          eq(courses.status, COURSE_STATUSES.PUBLISHED),
          eq(courses.isArchived, false),
          this.buildAvailableCourseIdsCondition(availableCourseIds),
        ),
      )
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
        categories.availableLocales,
        categories.baseLanguage,
        coursesSummaryStats.freePurchasedCount,
        coursesSummaryStats.paidPurchasedCount,
        courses.availableLocales,
        courses.baseLanguage,
      )
      .orderBy(desc(sql`COUNT(${studentCourses.id})`), desc(courses.createdAt))
      .limit(limit);
  }

  async findPublishedCourses(
    { title, language }: { title?: string; language: SupportedLanguages },
    { page, perPage }: Omit<CourseCatalogPageOptions, "sort">,
    db: DatabasePg,
  ) {
    const localizedTitle = this.localizationService.getLocalizedSqlField(courses.title, language);

    return addPagination(
      db
        .select({ id: courses.id, title: localizedTitle })
        .from(courses)
        .where(and(...this.buildPublishedCoursesConditions(title, language)))
        .orderBy(asc(localizedTitle))
        .$dynamic(),
      page,
      perPage,
    );
  }

  async countPublishedCourses(
    { title, language }: { title?: string; language: SupportedLanguages },
    db: DatabasePg,
  ) {
    const [{ totalItems }] = await db
      .select({ totalItems: count() })
      .from(courses)
      .where(and(...this.buildPublishedCoursesConditions(title, language)));

    return totalItems;
  }

  async findContentCreatorCourses(contentCreatorCoursesFilters: ContentCreatorCoursesFilters) {
    const { currentUserId, language } = contentCreatorCoursesFilters;
    const enrolledStudentCourses = alias(studentCourses, "enrolled_student_courses");
    const enrolledUsers = alias(users, "enrolled_users");

    return this.db
      .select({
        id: courses.id,
        description: this.localizationService.getLocalizedSqlField(courses.description, language),
        title: this.localizationService.getLocalizedSqlField(courses.title, language),
        thumbnailUrl: courses.thumbnailS3Key,
        authorId: sql<string>`${courses.authorId}`,
        author: courseAuthorNameSql(),
        authorEmail: sql<string>`${users.email}`,
        authorAvatarUrl: courseAuthorAvatarReferenceSql(),
        category: this.localizationService.getLocalizedSqlField(
          categories.title,
          language,
          categories,
        ),
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN true ELSE false END`,
        enrolledParticipantCount: sql<number>`COUNT(DISTINCT CASE WHEN ${enrolledUsers.id} IS NOT NULL THEN ${enrolledStudentCourses.studentId} END)::int`,
        courseChapterCount: courses.chapterCount,
        completedChapterCount: sql<number>`0`,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasFreeChapters: courseHasFreeChaptersSql(),
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
        originType: courses.originType,
        isContentReadonly: sql<boolean>`${courses.originType} = 'exported'`,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, courses.id), eq(studentCourses.studentId, currentUserId)),
      )
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .leftJoin(
        enrolledStudentCourses,
        and(
          eq(enrolledStudentCourses.courseId, courses.id),
          eq(enrolledStudentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .leftJoin(
        enrolledUsers,
        and(
          eq(enrolledUsers.id, enrolledStudentCourses.studentId),
          isNull(enrolledUsers.deletedAt),
        ),
      )
      .leftJoin(
        groupCourses,
        and(
          eq(groupCourses.courseId, courses.id),
          eq(groupCourses.groupId, studentCourses.enrolledByGroupId),
        ),
      )
      .where(and(...this.buildContentCreatorCoursesConditions(contentCreatorCoursesFilters)))
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
        categories.availableLocales,
        categories.baseLanguage,
        courses.availableLocales,
        courses.baseLanguage,
        studentCourses.status,
        groupCourses.dueDate,
      )
      .orderBy(
        sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NULL THEN TRUE ELSE FALSE END`,
        courses.title,
      );
  }

  private buildManagedCoursesConditions({
    filters,
    includeArchived,
    language,
    accessScope,
  }: ManagedCoursesFilters) {
    const conditions = this.buildFiltersConditions(
      { ...filters, isArchived: includeArchived ? undefined : (filters.isArchived ?? false) },
      false,
      language,
    );

    const accessCondition = this.buildCourseListAccessCondition(accessScope);

    if (accessCondition) conditions.push(accessCondition);

    return conditions;
  }

  /**
   * Course editors with `COURSE_UPDATE` see every course; others see their own courses and, when
   * they manage groups, the courses assigned to those groups.
   */
  private buildCourseListAccessCondition({
    currentUser,
    currentUserId,
    currentUserPermissions = [],
  }: CourseListAccessScope): SQL | undefined {
    if (hasPermission(currentUserPermissions, PERMISSIONS.COURSE_UPDATE)) return undefined;

    const canUpdateOwnCourse = hasPermission(currentUserPermissions, PERMISSIONS.COURSE_UPDATE_OWN);
    const ownCourseCondition =
      currentUserId && canUpdateOwnCourse ? eq(courses.authorId, currentUserId) : undefined;

    if (
      !currentUser ||
      !hasPermission(currentUser.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
    ) {
      return ownCourseCondition;
    }

    const managedCourseCondition = getGroupManagerCourseScopeCondition(currentUser, courses.id, []);

    return or(ownCourseCondition, managedCourseCondition) ?? sql`FALSE`;
  }

  private buildStudentCoursesConditions({ studentId, filters, language }: StudentCoursesFilters) {
    return [
      eq(studentCourses.studentId, studentId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      or(eq(courses.status, "published"), eq(courses.status, "private")),
      isNull(users.deletedAt),
      ...this.buildFiltersConditions(filters, false, language),
    ];
  }

  private buildAvailableCoursesConditions({
    filters,
    language,
    availableCourseIds,
  }: AvailableCoursesFilters) {
    return [
      eq(courses.status, COURSE_STATUSES.PUBLISHED),
      eq(courses.isArchived, false),
      ...this.buildFiltersConditions(filters, true, language),
      this.buildAvailableCourseIdsCondition(availableCourseIds),
    ];
  }

  private buildAvailableCategoriesSubquery(
    availableCoursesFilters: AvailableCoursesFilters,
    db: DatabasePg,
  ) {
    return db
      .select({ categoryId: courses.categoryId })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(users, eq(courses.authorId, users.id))
      .where(
        and(
          ...this.buildAvailableCoursesConditions(availableCoursesFilters),
          isNotNull(courses.categoryId),
        ),
      )
      .groupBy(courses.categoryId)
      .as("available_course_categories");
  }

  /** An empty list means "no restriction", matching the callers' existing behaviour. */
  private buildAvailableCourseIdsCondition(availableCourseIds: UUIDType[]) {
    return availableCourseIds.length > 0 ? inArray(courses.id, availableCourseIds) : undefined;
  }

  private buildPublishedCoursesConditions(title: string | undefined, language: SupportedLanguages) {
    return [
      eq(courses.status, COURSE_STATUSES.PUBLISHED),
      eq(courses.isArchived, false),
      title?.trim()
        ? this.localizationService.getLocalizedFieldSearchCondition(
            courses.title,
            `%${title.trim()}%`,
            language,
          )
        : undefined,
    ];
  }

  private buildContentCreatorCoursesConditions({
    currentUserId,
    authorId,
    scope,
    excludeCourseId,
    title,
    description,
    availableCourseIds,
  }: ContentCreatorCoursesFilters) {
    const isAvailableScope = scope === COURSE_ENROLLMENT_SCOPES.AVAILABLE;
    const isEnrolledScope = scope === COURSE_ENROLLMENT_SCOPES.ENROLLED;

    return [
      eq(courses.status, "published"),
      eq(courses.authorId, authorId),
      isAvailableScope
        ? eq(courses.isArchived, false)
        : or(eq(courses.isArchived, false), eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED)),
      excludeCourseId ? ne(courses.id, excludeCourseId) : undefined,
      isEnrolledScope ? eq(studentCourses.studentId, currentUserId) : undefined,
      isEnrolledScope ? eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED) : undefined,
      isAvailableScope ? inArray(courses.id, availableCourseIds) : undefined,
      title ? this.buildLocalizedValueSearchCondition(courses.title, title) : undefined,
      description
        ? this.buildLocalizedValueSearchCondition(courses.description, description)
        : undefined,
    ];
  }

  private buildFiltersConditions(
    filters: CoursesFilterSchema,
    publishedOnly = true,
    language?: SupportedLanguages,
  ) {
    const conditions: SQL[] = [];

    if (filters.title) {
      conditions.push(this.buildLocalizedValueSearchCondition(courses.title, filters.title));
    }

    if (filters.description) {
      conditions.push(
        this.buildLocalizedValueSearchCondition(courses.description, filters.description),
      );
    }

    if (filters.category) {
      conditions.push(
        this.localizationService.getLocalizedFieldSearchCondition(
          categories.title,
          `%${filters.category}%`,
          language,
          { baseTable: categories, fallbackToBaseLanguage: true },
        ),
      );
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
    if (filters.isArchived !== undefined) {
      conditions.push(eq(courses.isArchived, filters.isArchived));
    }

    if (publishedOnly) {
      conditions.push(eq(courses.status, "published"));
    }

    return conditions;
  }

  /** Matches the value in any language of a localized JSONB field. */
  private buildLocalizedValueSearchCondition(field: AnyPgColumn, value: string) {
    return sql`EXISTS (SELECT 1 FROM jsonb_each_text(${field}) AS t(k, v) WHERE v ILIKE ${`%${value}%`})`;
  }

  private buildCourseSortColumn(sort: CourseSortField, language?: SupportedLanguages) {
    return match<string, SQL | AnyPgColumn>(sort)
      .with(
        CourseSortFields.author,
        () => sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
      )
      .with(CourseSortFields.category, () =>
        this.localizationService.getLocalizedSqlField(categories.title, language, categories),
      )
      .with(CourseSortFields.creationDate, () => courses.createdAt)
      .with(CourseSortFields.chapterCount, () => count(studentCourses.courseId))
      .with(CourseSortFields.enrolledParticipantsCount, () => count(studentCourses.courseId))
      .otherwise(() => courses.title);
  }

  private buildStudentCourseSelection(language: SupportedLanguages) {
    return {
      id: courses.id,
      title: this.localizationService.getLocalizedSqlField(courses.title, language),
      description: this.localizationService.getLocalizedSqlField(courses.description, language),
      thumbnailUrl: courses.thumbnailS3Key,
      authorId: sql<string>`${courses.authorId}`,
      author: courseAuthorNameSql(),
      authorEmail: sql<string>`${users.email}`,
      authorAvatarUrl: courseAuthorAvatarReferenceSql(),
      category: this.localizationService.getLocalizedSqlField(
        categories.title,
        language,
        categories,
      ),
      enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
      enrolledParticipantCount: courseEnrolledParticipantCountSql(),
      courseChapterCount: courses.chapterCount,
      completedChapterCount: sql<number>`COALESCE(${studentCourses.finishedChapterCount}, 0)`,
      repetitionCompletedChapterCount: sql<number | null>`${this.db
        .select({ finishedChapterCount: courseLearningStates.finishedChapterCount })
        .from(courseLearningStates)
        .where(
          and(
            eq(courseLearningStates.courseId, courses.id),
            eq(courseLearningStates.studentId, studentCourses.studentId),
            eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.REPETITION),
          ),
        )}`,
      priceInCents: courses.priceInCents,
      currency: courses.currency,
      hasFreeChapter: courseHasFreeChaptersSql(),
      dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
    };
  }
}
