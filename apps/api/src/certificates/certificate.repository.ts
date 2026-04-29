import { Inject, Injectable } from "@nestjs/common";
import { eq, and, countDistinct, sql, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  certificates,
  users,
  courses,
  chapters,
  lessons,
  studentCourses,
  tenants,
} from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

const POINTS_PER_CHAPTER = 10;
const POINTS_PER_AI_PASS = 30;
const POINTS_PER_COURSE = 50;

const coursePointsValueSql = sql<number>`(
  ${POINTS_PER_COURSE}
  + (
    SELECT COUNT(*)::INTEGER FROM ${chapters}
    WHERE ${chapters.courseId} = ${courses.id}
  ) * ${POINTS_PER_CHAPTER}
  + (
    SELECT COUNT(*)::INTEGER FROM ${lessons}
    INNER JOIN ${chapters} ON ${chapters.id} = ${lessons.chapterId}
    WHERE ${chapters.courseId} = ${courses.id}
      AND ${lessons.type} = ${LESSON_TYPES.AI_MENTOR}
  ) * ${POINTS_PER_AI_PASS}
)::INTEGER`;

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
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx || this.db;

    const queryDB = dbInstance
      .select({
        id: certificates.id,
        courseId: certificates.courseId,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
        userId: certificates.userId,
        createdAt: certificates.createdAt,
        updatedAt: certificates.updatedAt,
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
      .where(and(eq(certificates.userId, userId), isNull(users.deletedAt)))
      .orderBy(sortOrder(certificates.createdAt));

    return addPagination(queryDB.$dynamic(), page, perPage);
  }

  async countByUserId(userId: string, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx || this.db;

    const [{ totalItems }] = await dbInstance
      .select({ totalItems: countDistinct(certificates.id) })
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(and(eq(certificates.userId, userId), isNull(users.deletedAt)));

    return totalItems;
  }

  async findUserById(userId: string, trx?: PostgresJsDatabase<typeof schema>) {
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

  async findCourseById(courseId: string, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx || this.db;

    const [course] = await dbInstance
      .select({
        title: this.localizationService.getLocalizedSqlField(courses.title),
        certificateEnabled: courses.hasCertificate,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course;
  }

  async findCourseCompletion(
    userId: string,
    courseId: string,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
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
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx || this.db;

    const [certificate] = await dbInstance
      .select({
        id: certificates.id,
        courseId: certificates.courseId,
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
        userId: certificates.userId,
        createdAt: certificates.createdAt,
        updatedAt: certificates.updatedAt,
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
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title, language),
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
        pointsValue: coursePointsValueSql,
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
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        certificateSignature: sql<string | null>`(${courses.settings} ->> 'certificateSignature')`,
        certificateFontColor: sql<string | null>`(${courses.settings} ->> 'certificateFontColor')`,
        pointsValue: coursePointsValueSql,
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
      .where(and(eq(certificates.id, certificateId), isNull(users.deletedAt)));

    return certificate;
  }

  async findExistingCertificate(
    userId: string,
    courseId: string,
    trx?: PostgresJsDatabase<typeof schema>,
  ) {
    const dbInstance = trx || this.db;

    const [existingCertificate] = await dbInstance
      .select()
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .where(
        and(
          eq(certificates.userId, userId),
          eq(certificates.courseId, courseId),
          isNull(users.deletedAt),
        ),
      );

    return existingCertificate;
  }

  async create(userId: string, courseId: string, trx?: PostgresJsDatabase<typeof schema>) {
    const dbInstance = trx || this.db;

    const [createdCertificate] = await dbInstance
      .insert(certificates)
      .values({
        userId: userId,
        courseId: courseId,
      })
      .returning();

    return createdCertificate;
  }

  async transaction<T>(
    callback: (trx: PostgresJsDatabase<typeof schema>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }
}
