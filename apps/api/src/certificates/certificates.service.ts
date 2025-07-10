import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, countDistinct, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { certificates, users, courses, studentCourses } from "src/storage/schema";

import type { CertificatesQuery, AllCertificatesResponse } from "./certificates.types";
import type { PaginatedResponse } from "src/common";

@Injectable()
export class CertificatesService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getAllCertificates(
    query: CertificatesQuery,
  ): Promise<PaginatedResponse<AllCertificatesResponse>> {
    const { userId, page = 1, perPage = DEFAULT_PAGE_SIZE, sort = "createdAt" } = query;
    const { sortOrder } = getSortOptions(sort);

    try {
      return this.db.transaction(async (trx) => {
        const queryDB = trx
          .select({
            id: certificates.id,
            courseId: certificates.courseId,
            courseTitle: courses.title,
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
          .where(eq(certificates.userId, userId))
          .orderBy(sortOrder(certificates.createdAt));

        const paginatedQuery = addPagination(queryDB.$dynamic(), page, perPage);
        const data = await paginatedQuery;

        const [{ totalItems }] = await trx
          .select({ totalItems: countDistinct(certificates.id) })
          .from(certificates)
          .where(eq(certificates.userId, userId));

        return { data, pagination: { totalItems, page, perPage } };
      });
    } catch (error) {
      console.error("Error fetching certificates:", error);
      throw new Error("Failed to fetch certificates");
    }
  }

  async createCertificate(userId: string, courseId: string) {
    try {
      const [existingUser] = await this.db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, userId));

      const [existingCourse] = await this.db
        .select({
          title: courses.title,
          certificateEnabled: courses.hasCertificate,
        })
        .from(courses)
        .where(eq(courses.id, courseId));

      const [courseCompletion] = await this.db
        .select({
          completedAt: studentCourses.completedAt,
        })
        .from(studentCourses)
        .where(and(eq(studentCourses.studentId, userId), eq(studentCourses.courseId, courseId)));

      if (!existingUser) throw new NotFoundException("User not found");
      if (!existingCourse) throw new NotFoundException("Course not found");
      if (!existingCourse.certificateEnabled)
        throw new BadRequestException("Certificates are disabled for this course");
      if (!courseCompletion?.completedAt)
        throw new BadRequestException("Course must be completed to generate certificate");

      const [existingCertificate] = await this.db
        .select()
        .from(certificates)
        .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));

      if (existingCertificate) throw new ConflictException("Certificate already exists");

      const [createdCertificate] = await this.db
        .insert(certificates)
        .values({
          userId: userId,
          courseId: courseId,
        })
        .returning();

      if (!createdCertificate) throw new ConflictException("Unable to create certificate");

      return {
        ...createdCertificate,
        fullName: `${existingUser.firstName} ${existingUser.lastName}`,
        courseTitle: existingCourse.title,
        completionDate: new Date(courseCompletion.completedAt).toISOString(),
      };
    } catch (error) {
      console.error("Error creating certificate:", error);
      throw error;
    }
  }
}
