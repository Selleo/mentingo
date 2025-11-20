import { Inject, Injectable } from "@nestjs/common";
import { eq, and, countDistinct, sql, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { certificates, users, courses, studentCourses } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

@Injectable()
export class CertificateRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
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
        courseTitle: sql<string>`courses.title->>'${language}'`,
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
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

    const { language } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    const [course] = await dbInstance
      .select({
        title: sql<string>`courses.title->>${language}`,
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
        courseTitle: sql<string>`courses.title->>'${language}'`,
        completionDate: studentCourses.completedAt,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
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
