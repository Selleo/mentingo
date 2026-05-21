import { Inject, Injectable } from "@nestjs/common";
import {
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_STATUSES,
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  COURSE_ENROLLMENT,
  SUPPORTED_LANGUAGES,
  type CertificateArchiveReason,
  type CertificateValidity,
  type SupportedLanguages,
} from "@repo/shared";
import {
  eq,
  and,
  countDistinct,
  ilike,
  sql,
  isNull,
  inArray,
  lte,
  gt,
  getTableColumns,
  or,
  type SQL,
} from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { addPagination } from "src/common/pagination";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  certificates,
  users,
  courses,
  studentCourses,
  tenants,
  groups,
  groupUsers,
  studentLessonProgress,
  studentChapterProgress,
  studentQuestionAnswers,
  chapters,
  lessons,
  questions,
  quizAttempts,
  scormAttempts,
} from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import type {
  CertificateProgressResetTarget,
  FindCertificateResetUsersParams,
} from "./certificates.types";

@Injectable()
export class CertificateRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findCertificatesByUserId(
    userId: string,
    page: number,
    perPage: number,
    sortOrder: any,
    language: SupportedLanguages,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx || this.db;

    const queryDB = dbInstance
      .select({
        ...getTableColumns(certificates),
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: certificates.issuedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
      })
      .from(certificates)
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .innerJoin(users, eq(users.id, certificates.userId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, certificates.userId),
          eq(studentCourses.courseId, certificates.courseId),
        ),
      )
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(sortOrder(certificates.createdAt));

    return addPagination(queryDB.$dynamic(), page, perPage);
  }

  async countByUserId(userId: string, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    const [{ totalItems }] = await dbInstance
      .select({ totalItems: countDistinct(certificates.id) })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return totalItems;
  }

  async findUserById(userId: string, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    const [user] = await dbInstance
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    return user;
  }

  async findCourseById(courseId: string, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    const [course] = await dbInstance
      .select({
        title: this.localizationService.getLocalizedSqlField(courses.title),
        certificateEnabled: courses.hasCertificate,
        settings: courses.settings,
        authorId: courses.authorId,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course;
  }

  async findCourseCompletion(userId: string, courseId: string, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    const [courseCompletion] = await dbInstance
      .select({
        completedAt: studentCourses.completedAt,
      })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          eq(studentCourses.studentId, userId),
          eq(studentCourses.courseId, courseId),
          isNull(users.deletedAt),
        ),
      );

    return courseCompletion;
  }

  async findCertificateByUserAndCourse(
    userId: string,
    courseId: string,
    language: SupportedLanguages,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx || this.db;

    const [certificate] = await dbInstance
      .select({
        ...getTableColumns(certificates),
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: certificates.issuedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
      })
      .from(certificates)
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .innerJoin(users, eq(users.id, certificates.userId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, certificates.userId),
          eq(studentCourses.courseId, certificates.courseId),
        ),
      )
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return certificate;
  }

  async findOwnedCertificateById(userId: string, certificateId: string) {
    const [certificate] = await this.db
      .select({
        id: certificates.id,
        tenantId: certificates.tenantId,
        courseId: certificates.courseId,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(
        and(
          eq(certificates.id, certificateId),
          eq(certificates.userId, userId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return certificate;
  }

  async findOwnedCertificateByIdForRender(
    userId: string,
    certificateId: string,
    language: SupportedLanguages,
  ) {
    const [certificate] = await this.db
      .select({
        id: certificates.id,
        tenantId: certificates.tenantId,
        createdAt: certificates.createdAt,
        issuedAt: certificates.issuedAt,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: certificates.issuedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, certificates.userId),
          eq(studentCourses.courseId, certificates.courseId),
        ),
      )
      .where(
        and(
          eq(certificates.id, certificateId),
          eq(certificates.userId, userId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return certificate;
  }

  async findPublicShareCertificateById(certificateId: string, language: SupportedLanguages) {
    const [certificate] = await this.dbAdmin
      .select({
        id: certificates.id,
        tenantId: certificates.tenantId,
        tenantHost: tenants.host,
        tenantName: tenants.name,
        courseId: certificates.courseId,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        issuedAt: certificates.issuedAt,
        completionDate: certificates.issuedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .innerJoin(tenants, eq(tenants.id, certificates.tenantId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, certificates.userId),
          eq(studentCourses.courseId, certificates.courseId),
        ),
      )
      .where(
        and(
          eq(certificates.id, certificateId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return certificate;
  }

  async findExistingCertificate(userId: string, courseId: string, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    const [existingCertificate] = await dbInstance
      .select({ ...getTableColumns(certificates), completionDate: certificates.issuedAt })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return existingCertificate;
  }

  async create(
    userId: string,
    courseId: string,
    issuedAt: Date,
    expiresAt: Date | null,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx || this.db;

    const [createdCertificate] = await dbInstance
      .insert(certificates)
      .values({
        userId,
        courseId,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
      })
      .returning();

    return createdCertificate;
  }

  async findActiveCertificatesForCourse(courseId: UUIDType, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    return dbInstance
      .select({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(
        and(
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );
  }

  async getCertificateValidityImpact(
    courseId: UUIDType,
    certificateValidity: CertificateValidity | null,
  ) {
    const expiresAt = this.getCertificateExpirySql(certificateValidity);

    const [validityImpact] = await this.db
      .select({
        activeCertificateCount: sql<number>`count(${certificates.id})::int`,
        immediatelyExpiringCertificateCount: sql<number>`
          count(*) filter (
            where ${expiresAt} is not null
              and ${expiresAt} <= CURRENT_TIMESTAMP
          )::int
        `,
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(
        and(
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );

    return validityImpact;
  }

  async findCertificateResetGroups(courseId: UUIDType) {
    return this.db
      .select({
        id: groups.id,
        name: groups.name,
        activeCertificateCount: countDistinct(certificates.id),
      })
      .from(groups)
      .innerJoin(groupUsers, eq(groupUsers.groupId, groups.id))
      .innerJoin(
        users,
        and(eq(users.id, groupUsers.userId), eq(users.archived, false), isNull(users.deletedAt)),
      )
      .innerJoin(
        certificates,
        and(
          eq(certificates.userId, users.id),
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
        ),
      )
      .groupBy(groups.id, groups.name);
  }

  async findCertificateResetUsers(courseId: UUIDType) {
    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        hasActiveCertificate: sql<boolean>`count(${certificates.id}) > 0`,
      })
      .from(users)
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, users.id),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .leftJoin(
        certificates,
        and(
          eq(certificates.userId, users.id),
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
        ),
      )
      .where(and(eq(users.archived, false), isNull(users.deletedAt)))
      .groupBy(users.id, users.firstName, users.lastName, users.email);
  }

  async findPaginatedCertificateResetUsers(params: FindCertificateResetUsersParams) {
    const conditions = this.getCertificateResetUsersConditions(params.search);

    return this.db.transaction(async (trx) => {
      const resetUsersQuery = trx
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .innerJoin(
          studentCourses,
          and(
            eq(studentCourses.studentId, users.id),
            eq(studentCourses.courseId, params.courseId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        )
        .innerJoin(
          certificates,
          and(
            eq(certificates.userId, users.id),
            eq(certificates.courseId, params.courseId),
            eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          ),
        )
        .where(and(...conditions))
        .groupBy(users.id, users.firstName, users.lastName, users.email)
        .orderBy(users.lastName, users.firstName, users.email)
        .$dynamic();

      const rows = await addPagination(resetUsersQuery, params.page, params.perPage);

      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(users.id) })
        .from(users)
        .innerJoin(
          studentCourses,
          and(
            eq(studentCourses.studentId, users.id),
            eq(studentCourses.courseId, params.courseId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          ),
        )
        .innerJoin(
          certificates,
          and(
            eq(certificates.userId, users.id),
            eq(certificates.courseId, params.courseId),
            eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          ),
        )
        .where(and(...conditions));

      return { rows, totalItems };
    });
  }

  async countCertificateResetUsers(courseId: UUIDType) {
    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(users.id) })
      .from(users)
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, users.id),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .innerJoin(
        certificates,
        and(
          eq(certificates.userId, users.id),
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
        ),
      )
      .where(and(...this.getCertificateResetUsersConditions()));

    return totalItems;
  }

  private getCertificateResetUsersConditions(search?: string): SQL[] {
    const conditions: SQL[] = [eq(users.archived, false), isNull(users.deletedAt)];

    const trimmedSearch = search?.trim();

    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch}%`;

      conditions.push(
        or(
          ilike(users.firstName, searchPattern),
          ilike(users.lastName, searchPattern),
          ilike(users.email, searchPattern),
          sql<boolean>`concat(${users.firstName}, ' ', ${users.lastName}) ilike ${searchPattern}`,
          sql<boolean>`concat(${users.lastName}, ' ', ${users.firstName}) ilike ${searchPattern}`,
        )!,
      );
    }

    return conditions;
  }

  async findActiveCertificatesForUsers(courseId: UUIDType, userIds: UUIDType[], trx?: DatabasePg) {
    if (!userIds.length) return [];

    const dbInstance = trx || this.db;

    return dbInstance
      .select({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(
        and(
          eq(certificates.courseId, courseId),
          inArray(certificates.userId, userIds),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );
  }

  async findActiveCertificatesForGroups(
    courseId: UUIDType,
    groupIds: UUIDType[],
    trx?: DatabasePg,
  ) {
    if (!groupIds.length) return [];

    const dbInstance = trx || this.db;

    return dbInstance
      .selectDistinct({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .innerJoin(groupUsers, eq(groupUsers.userId, certificates.userId))
      .where(
        and(
          eq(certificates.courseId, courseId),
          inArray(groupUsers.groupId, groupIds),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          isNull(users.deletedAt),
        ),
      );
  }

  async findCertificatesNeedingExpirationWarning(now: Date, warningDate: Date) {
    return this.db
      .select({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(
        and(
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          gt(certificates.expiresAt, now.toISOString()),
          lte(certificates.expiresAt, warningDate.toISOString()),
          isNull(certificates.expirationWarningSentAt),
          isNull(users.deletedAt),
        ),
      );
  }

  async markExpirationWarningsSent(certificateIds: UUIDType[]) {
    if (!certificateIds.length) return [];

    return this.db
      .update(certificates)
      .set({ expirationWarningSentAt: sql`now()` })
      .where(inArray(certificates.id, certificateIds))
      .returning();
  }

  async findExpiredActiveCertificates(now: Date, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    return dbInstance
      .select({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(
        and(
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          lte(certificates.expiresAt, now.toISOString()),
          isNull(users.deletedAt),
        ),
      );
  }

  async findExpiredActiveCertificatesForCourse(courseId: UUIDType, now: Date, trx?: DatabasePg) {
    const dbInstance = trx || this.db;

    return dbInstance
      .select({
        ...getTableColumns(certificates),
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .innerJoin(courses, eq(courses.id, certificates.courseId))
      .where(
        and(
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          lte(certificates.expiresAt, now.toISOString()),
          isNull(users.deletedAt),
        ),
      );
  }

  async updateActiveCertificateExpirationsForCourse(
    courseId: UUIDType,
    certificateValidity: CertificateValidity | null,
    trx?: DatabasePg,
  ) {
    const dbInstance = trx || this.db;

    const expiresAt = this.getCertificateExpirySql(certificateValidity);

    return dbInstance
      .update(certificates)
      .set({
        expiresAt,
        expirationWarningSentAt: null,
      })
      .where(
        and(
          eq(certificates.courseId, courseId),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
          sql`EXISTS (
            SELECT 1
            FROM ${users}
            WHERE ${users.id} = ${certificates.userId}
              AND ${users.deletedAt} IS NULL
          )`,
        ),
      )
      .returning();
  }

  private getCertificateExpirySql(certificateValidity: CertificateValidity | null | undefined) {
    if (!certificateValidity) return sql<string | null>`NULL`;

    if (certificateValidity.type === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE) {
      return sql<string>`${new Date(
        `${certificateValidity.date}T23:59:59.999Z`,
      ).toISOString()}::timestamp with time zone`;
    }

    if (certificateValidity.unit === CERTIFICATE_VALIDITY_UNITS.DAYS) {
      return sql<string>`${certificates.issuedAt} + make_interval(days => ${certificateValidity.value})`;
    }

    if (certificateValidity.unit === CERTIFICATE_VALIDITY_UNITS.MONTHS) {
      return sql<string>`${certificates.issuedAt} + make_interval(months => ${certificateValidity.value})`;
    }

    return sql<string>`${certificates.issuedAt} + make_interval(years => ${certificateValidity.value})`;
  }

  async archiveCertificates(
    certificateIds: UUIDType[],
    reason: CertificateArchiveReason = CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
    trx?: DatabasePg,
  ) {
    if (!certificateIds.length) return [];

    const dbInstance = trx || this.db;

    return dbInstance
      .update(certificates)
      .set({
        status: CERTIFICATE_STATUSES.ARCHIVED,
        archivedAt: sql`now()`,
        archiveReason: reason,
      })
      .where(
        and(
          inArray(certificates.id, certificateIds),
          eq(certificates.status, CERTIFICATE_STATUSES.ACTIVE),
        ),
      )
      .returning();
  }

  async findProgressResetTargetsForCertificates(
    certificateIds: UUIDType[],
    trx?: DatabasePg,
  ): Promise<CertificateProgressResetTarget[]> {
    if (!certificateIds.length) return [];

    const dbInstance = trx || this.db;

    return dbInstance
      .select({
        courseId: certificates.courseId,
        userIds: sql<UUIDType[]>`array_agg(DISTINCT ${certificates.userId})`,
      })
      .from(certificates)
      .where(inArray(certificates.id, certificateIds))
      .groupBy(certificates.courseId);
  }

  async resetCourseProgress(courseId: UUIDType, userIds: UUIDType[], trx?: DatabasePg) {
    if (!userIds.length) return;

    const dbInstance = trx || this.db;

    const courseChapterIds = dbInstance
      .select({ id: chapters.id })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));

    const courseQuestionIds = dbInstance
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(lessons, eq(lessons.id, questions.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, courseId));

    await dbInstance
      .delete(studentQuestionAnswers)
      .where(
        and(
          inArray(studentQuestionAnswers.studentId, userIds),
          inArray(studentQuestionAnswers.questionId, courseQuestionIds),
        ),
      );

    await dbInstance
      .delete(quizAttempts)
      .where(and(eq(quizAttempts.courseId, courseId), inArray(quizAttempts.userId, userIds)));

    await dbInstance
      .delete(scormAttempts)
      .where(and(eq(scormAttempts.courseId, courseId), inArray(scormAttempts.studentId, userIds)));

    await dbInstance
      .update(studentLessonProgress)
      .set({
        completedQuestionCount: 0,
        quizScore: sql`
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM ${lessons}
              WHERE ${lessons.id} = ${studentLessonProgress.lessonId}
                AND ${lessons.type} = ${LESSON_TYPES.QUIZ}
            )
            THEN 0
            ELSE NULL
          END
        `,
        attempts: null,
        isQuizPassed: null,
        isStarted: false,
        completedAt: null,
        languageAnswered: SUPPORTED_LANGUAGES.EN,
      })
      .where(
        and(
          inArray(studentLessonProgress.studentId, userIds),
          inArray(studentLessonProgress.chapterId, courseChapterIds),
        ),
      );

    await dbInstance
      .update(studentChapterProgress)
      .set({
        completedLessonCount: 0,
        completedAt: null,
        completedAsFreemium: false,
      })
      .where(
        and(
          eq(studentChapterProgress.courseId, courseId),
          inArray(studentChapterProgress.studentId, userIds),
        ),
      );

    await dbInstance
      .update(studentCourses)
      .set({
        progress: PROGRESS_STATUSES.NOT_STARTED,
        finishedChapterCount: 0,
        completedAt: null,
        courseCompletionMetadata: null,
      })
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, userIds)),
      );
  }
}
