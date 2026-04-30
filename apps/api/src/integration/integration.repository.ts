import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, countDistinct, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { P, match } from "ts-pattern";
import { validate as uuidValidate } from "uuid";

import { DatabasePg } from "src/common";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  certificates,
  chapters,
  courses,
  integrationApiKeys,
  lessons,
  studentCourses,
  studentLessonProgress,
  tenants,
  users,
} from "src/storage/schema";

import type {
  FindIntegrationKeyCandidateParams,
  IntegrationApiKeyCandidate,
  IntegrationKeyMetadataRecord,
  IntegrationTrainingResultCourse,
  IntegrationTrainingResultsData,
  IntegrationTrainingResultRow,
  IntegrationTrainingResultsQuery,
  IntegrationTrainingResultsScope,
  RotateIntegrationKeyParams,
} from "./integration.types";

type NormalizedTrainingResultsQuery = {
  scope: IntegrationTrainingResultsQuery["scope"];
  studentId?: string;
  courseId?: string;
  page: number;
  perPage: number;
};

@Injectable()
export class IntegrationRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getCurrentActiveKeyByCreator(userId: string): Promise<IntegrationKeyMetadataRecord | null> {
    const [key] = await this.dbAdmin
      .select({
        id: integrationApiKeys.id,
        keyPrefix: integrationApiKeys.keyPrefix,
        createdAt: integrationApiKeys.createdAt,
        updatedAt: integrationApiKeys.updatedAt,
        lastUsedAt: integrationApiKeys.lastUsedAt,
      })
      .from(integrationApiKeys)
      .where(
        and(eq(integrationApiKeys.createdByUserId, userId), isNull(integrationApiKeys.revokedAt)),
      )
      .limit(1);

    return key ?? null;
  }

  async rotateAdminKey(
    params: RotateIntegrationKeyParams,
  ): Promise<IntegrationKeyMetadataRecord | null> {
    const [createdKey] = await this.db.transaction(async (trx) => {
      await trx
        .update(integrationApiKeys)
        .set({ revokedAt: sql`NOW()` })
        .where(
          and(
            eq(integrationApiKeys.createdByUserId, params.userId),
            isNull(integrationApiKeys.revokedAt),
          ),
        );

      return trx
        .insert(integrationApiKeys)
        .values({
          keyPrefix: params.keyPrefix,
          keyHash: params.keyHash,
          tenantId: params.tenantId,
          createdByUserId: params.userId,
        })
        .returning({
          id: integrationApiKeys.id,
          keyPrefix: integrationApiKeys.keyPrefix,
          createdAt: integrationApiKeys.createdAt,
          updatedAt: integrationApiKeys.updatedAt,
          lastUsedAt: integrationApiKeys.lastUsedAt,
        });
    });

    return createdKey ?? null;
  }

  async getActiveKeyCandidate(
    params: FindIntegrationKeyCandidateParams,
  ): Promise<IntegrationApiKeyCandidate | null> {
    const [key] = await this.dbAdmin
      .select({
        keyId: integrationApiKeys.id,
        keyHash: integrationApiKeys.keyHash,
        keyTenantId: integrationApiKeys.tenantId,
        keyTenantIsManaging: tenants.isManaging,
        userId: users.id,
        userEmail: users.email,
        userDeletedAt: users.deletedAt,
      })
      .from(integrationApiKeys)
      .innerJoin(users, eq(users.id, integrationApiKeys.createdByUserId))
      .innerJoin(tenants, eq(tenants.id, integrationApiKeys.tenantId))
      .where(
        and(
          eq(integrationApiKeys.keyPrefix, params.keyPrefix),
          isNull(integrationApiKeys.revokedAt),
        ),
      )
      .limit(1);

    return key;
  }

  async getAllTenants() {
    return this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
      })
      .from(tenants)
      .orderBy(tenants.name);
  }

  async getTenantById(tenantId: string) {
    const [tenant] = await this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        isManaging: tenants.isManaging,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant ?? null;
  }

  async markKeyAsUsed(keyId: string): Promise<void> {
    await this.dbAdmin
      .update(integrationApiKeys)
      .set({ lastUsedAt: sql`NOW()` })
      .where(eq(integrationApiKeys.id, keyId));
  }

  async getTrainingResults(
    tenantId: string,
    query: IntegrationTrainingResultsQuery,
  ): Promise<IntegrationTrainingResultsData> {
    const standardizedQuery = this.normalizeTrainingResultsQuery(query);
    const { filters } = this.buildTrainingResultsFilters(tenantId, standardizedQuery);

    return this.db.transaction(async (trx) => {
      const totalItems = await this.getTrainingResultTotalItems(trx, filters);

      const { page, perPage } = standardizedQuery;

      if (totalItems === 0) {
        return {
          data: [],
          pagination: {
            totalItems,
            page,
            perPage,
          },
        };
      }

      const data = await this.getTrainingResultRows(trx, tenantId, standardizedQuery, filters);

      return {
        data,
        pagination: {
          totalItems,
          page,
          perPage,
        },
      };
    });
  }

  private normalizeTrainingResultsQuery(
    query: IntegrationTrainingResultsQuery,
  ): NormalizedTrainingResultsQuery {
    return {
      scope: query.scope,
      studentId: this.normalizeOptionalUuid(
        query.studentId,
        "integration.trainingResults.errors.invalidStudentId",
      ),
      courseId: this.normalizeOptionalUuid(
        query.courseId,
        "integration.trainingResults.errors.invalidCourseId",
      ),
      page: this.normalizePositiveNumber(query.page, 1),
      perPage: this.normalizePositiveNumber(query.perPage, DEFAULT_PAGE_SIZE),
    };
  }

  private buildTrainingResultsFilters(tenantId: string, query: NormalizedTrainingResultsQuery) {
    const scopeFilters = match(query)
      .with({ scope: "tenant" }, () => [])
      .with({ scope: "student", studentId: P.string }, ({ studentId }) => [
        eq(studentCourses.studentId, studentId),
      ])
      .with({ scope: "course", courseId: P.string }, ({ courseId }) => [
        eq(studentCourses.courseId, courseId),
      ])
      .with({ scope: "student" }, () => {
        throw new BadRequestException("integration.trainingResults.errors.studentIdRequired");
      })
      .with({ scope: "course" }, () => {
        throw new BadRequestException("integration.trainingResults.errors.courseIdRequired");
      })
      .exhaustive();

    const filters = [
      eq(studentCourses.tenantId, tenantId),
      isNull(users.deletedAt),
      inArray(studentCourses.status, [
        COURSE_ENROLLMENT.ENROLLED,
        COURSE_ENROLLMENT.GROUP_ENROLLED,
      ]),
      ...scopeFilters,
    ];

    match(query)
      .with({ scope: P.union("tenant", "course"), studentId: P.string }, ({ studentId }) => {
        filters.push(eq(studentCourses.studentId, studentId));
      })
      .otherwise(() => undefined);

    match(query)
      .with({ scope: P.union("tenant", "student"), courseId: P.string }, ({ courseId }) => {
        filters.push(eq(studentCourses.courseId, courseId));
      })
      .otherwise(() => undefined);

    return { filters };
  }

  private async getTrainingResultTotalItems(db: DatabasePg, filters: SQL[]) {
    const enrollmentsCte = db.$with("training_result_enrollments").as(
      db
        .select({
          tenantId: studentCourses.tenantId,
          studentId: studentCourses.studentId,
          studentEmail: users.email,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          courseId: studentCourses.courseId,
          courseTitle: this.localizationService
            .getLocalizedSqlField(courses.title)
            .as("courseTitle"),
          certificateEnabled: courses.hasCertificate,
        })
        .from(studentCourses)
        .innerJoin(users, eq(users.id, studentCourses.studentId))
        .innerJoin(courses, eq(courses.id, studentCourses.courseId))
        .where(and(...filters)),
    );

    const [{ totalItems }] = await db
      .with(enrollmentsCte)
      .select({ totalItems: countDistinct(enrollmentsCte.studentId) })
      .from(enrollmentsCte);

    return totalItems ?? 0;
  }

  private async getTrainingResultRows(
    db: DatabasePg,
    tenantId: string,
    query: NormalizedTrainingResultsQuery,
    filters: SQL[],
  ): Promise<IntegrationTrainingResultRow[]> {
    const enrollmentsCte = db.$with("training_result_enrollments").as(
      db
        .select({
          tenantId: studentCourses.tenantId,
          studentId: studentCourses.studentId,
          studentEmail: users.email,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          courseId: studentCourses.courseId,
          courseTitle: this.localizationService
            .getLocalizedSqlField(courses.title)
            .as("courseTitle"),
          certificateEnabled: courses.hasCertificate,
          certificateIssuedAt: certificates.createdAt,
        })
        .from(studentCourses)
        .innerJoin(users, eq(users.id, studentCourses.studentId))
        .innerJoin(courses, eq(courses.id, studentCourses.courseId))
        .leftJoin(
          certificates,
          and(
            eq(certificates.userId, studentCourses.studentId),
            eq(certificates.courseId, studentCourses.courseId),
            eq(certificates.tenantId, studentCourses.tenantId),
          ),
        )
        .where(and(...filters)),
    );

    const pagedStudentsCte = db.$with("training_result_paged_students").as(
      db
        .with(enrollmentsCte)
        .selectDistinct({
          tenantId: enrollmentsCte.tenantId,
          studentId: enrollmentsCte.studentId,
          studentEmail: enrollmentsCte.studentEmail,
          studentFirstName: enrollmentsCte.studentFirstName,
          studentLastName: enrollmentsCte.studentLastName,
        })
        .from(enrollmentsCte)
        .orderBy(enrollmentsCte.studentEmail, enrollmentsCte.studentId)
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
    );

    const pagedEnrollmentsCte = db.$with("training_result_paged_enrollments").as(
      db
        .with(enrollmentsCte, pagedStudentsCte)
        .select({
          tenantId: enrollmentsCte.tenantId,
          studentId: enrollmentsCte.studentId,
          studentEmail: enrollmentsCte.studentEmail,
          studentFirstName: enrollmentsCte.studentFirstName,
          studentLastName: enrollmentsCte.studentLastName,
          courseId: enrollmentsCte.courseId,
          courseTitle: enrollmentsCte.courseTitle,
          certificateEnabled: enrollmentsCte.certificateEnabled,
          certificateIssuedAt: enrollmentsCte.certificateIssuedAt,
        })
        .from(enrollmentsCte)
        .innerJoin(pagedStudentsCte, eq(enrollmentsCte.studentId, pagedStudentsCte.studentId))
        .orderBy(enrollmentsCte.studentEmail, enrollmentsCte.courseTitle),
    );

    const lessonsSql = sql<IntegrationTrainingResultCourse["lessons"]>`
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'lessonId', ${lessons.id},
              'chapterId', ${chapters.id},
              'title', ${this.localizationService.getLocalizedSqlField(lessons.title)},
              'type', ${lessons.type},
              'completed', CASE WHEN ${
                studentLessonProgress.completedAt
              } IS NOT NULL THEN TRUE ELSE FALSE END,
              'completedAt', ${studentLessonProgress.completedAt}
            )
            ORDER BY ${chapters.displayOrder}, ${lessons.displayOrder}
          )
          FROM ${lessons}
          INNER JOIN ${chapters} ON ${chapters.id} = ${lessons.chapterId}
          INNER JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
          LEFT JOIN ${studentLessonProgress}
            ON ${studentLessonProgress.lessonId} = ${lessons.id}
           AND ${studentLessonProgress.chapterId} = ${chapters.id}
           AND ${studentLessonProgress.studentId} = ${pagedEnrollmentsCte.studentId}
           AND ${studentLessonProgress.tenantId} = ${pagedEnrollmentsCte.tenantId}
          WHERE ${lessons.tenantId} = ${tenantId}
            AND ${chapters.courseId} = ${pagedEnrollmentsCte.courseId}
        ),
        '[]'::jsonb
      )
    `;

    const quizzesSql = sql<IntegrationTrainingResultCourse["quizzes"]>`
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'lessonId', ${lessons.id},
              'chapterId', ${chapters.id},
              'title', ${this.localizationService.getLocalizedSqlField(lessons.title)},
              'score', ${studentLessonProgress.quizScore},
              'passed', ${studentLessonProgress.isQuizPassed},
              'attempts', ${studentLessonProgress.attempts},
              'completedAt', ${studentLessonProgress.completedAt}
            )
            ORDER BY ${chapters.displayOrder}, ${lessons.displayOrder}
          )
          FROM ${lessons}
          INNER JOIN ${chapters} ON ${chapters.id} = ${lessons.chapterId}
          INNER JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
          LEFT JOIN ${studentLessonProgress}
            ON ${studentLessonProgress.lessonId} = ${lessons.id}
           AND ${studentLessonProgress.chapterId} = ${chapters.id}
           AND ${studentLessonProgress.studentId} = ${pagedEnrollmentsCte.studentId}
           AND ${studentLessonProgress.tenantId} = ${pagedEnrollmentsCte.tenantId}
          WHERE ${lessons.tenantId} = ${tenantId}
            AND ${chapters.courseId} = ${pagedEnrollmentsCte.courseId}
            AND ${lessons.type} = 'quiz'
        ),
        '[]'::jsonb
      )
    `;

    const entries = await db
      .with(enrollmentsCte, pagedStudentsCte, pagedEnrollmentsCte)
      .select({
        scope: sql<IntegrationTrainingResultsScope>`${query.scope}`,
        tenantId: pagedEnrollmentsCte.tenantId,
        student: sql<IntegrationTrainingResultRow["student"]>`
          jsonb_build_object(
            'id', ${pagedEnrollmentsCte.studentId},
            'email', ${pagedEnrollmentsCte.studentEmail},
            'firstName', ${pagedEnrollmentsCte.studentFirstName},
            'lastName', ${pagedEnrollmentsCte.studentLastName},
            'fullName', ${pagedEnrollmentsCte.studentFirstName} || ' ' || ${pagedEnrollmentsCte.studentLastName}
          )
        `,
        courses: sql<IntegrationTrainingResultCourse[]>`
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ${pagedEnrollmentsCte.courseId},
                'title', ${pagedEnrollmentsCte.courseTitle},
                'lessons', ${lessonsSql},
                'quizzes', ${quizzesSql},
                'certificate', jsonb_build_object(
                  'enabled', ${pagedEnrollmentsCte.certificateEnabled},
                  'status', CASE
                    WHEN NOT ${pagedEnrollmentsCte.certificateEnabled} THEN 'not_applicable'
                    WHEN ${pagedEnrollmentsCte.certificateIssuedAt} IS NOT NULL THEN 'issued'
                    ELSE 'not_issued'
                  END,
                  'issuedAt', ${pagedEnrollmentsCte.certificateIssuedAt}
                )
              )
              ORDER BY ${pagedEnrollmentsCte.courseTitle}
            ),
            '[]'::jsonb
          )
        `,
      })
      .from(pagedEnrollmentsCte)
      .groupBy(
        pagedEnrollmentsCte.tenantId,
        pagedEnrollmentsCte.studentId,
        pagedEnrollmentsCte.studentEmail,
        pagedEnrollmentsCte.studentFirstName,
        pagedEnrollmentsCte.studentLastName,
      )
      .orderBy(pagedEnrollmentsCte.studentEmail, pagedEnrollmentsCte.studentId);

    return entries;
  }

  private normalizeOptionalUuid(value: string | undefined, errorMessage: string) {
    if (!value) return undefined;
    if (!uuidValidate(value)) throw new BadRequestException(errorMessage);

    return value;
  }

  private normalizePositiveNumber(value: unknown, defaultValue: number) {
    if (value === undefined || value === null || value === "") return defaultValue;

    const normalizedValue = Number(value);

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      throw new BadRequestException("integration.trainingResults.errors.invalidPagination");
    }

    return normalizedValue;
  }
}
