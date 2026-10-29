import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, PERMISSIONS } from "@repo/shared";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { DB } from "src/storage/db/db.providers";
import {
  courses,
  courseStudentsStats,
  coursesSummaryStats,
  userDetails,
  users,
} from "src/storage/schema";

import type { CourseAuthorMetadata } from "../types/course.types";
import type { CourseOwnershipBody } from "src/courses/schemas/course.schema";

@Injectable()
export class CourseAuthorRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findCourseAuthorAndOrigin(courseId: UUIDType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId, originType: courses.originType })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async findAuthorContact(authorId: UUIDType): Promise<CourseOwnershipBody | undefined> {
    const [author] = await this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    return author;
  }

  async findOwnershipCandidates(currentAuthorId: UUIDType): Promise<CourseOwnershipBody[]> {
    return this.db
      .select({
        id: users.id,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          ne(users.id, currentAuthorId),
          isNull(users.deletedAt),
          userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
        ),
      );
  }

  async findAuthorMetadata(
    authorId: UUIDType,
    db: DatabasePg = this.db,
  ): Promise<CourseAuthorMetadata | undefined> {
    const [author] = await db
      .select({
        authorId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePictureReference: users.avatarReference,
        jobTitle: userDetails.jobTitle,
        description: userDetails.description,
      })
      .from(users)
      .leftJoin(userDetails, eq(userDetails.userId, users.id))
      .where(eq(users.id, authorId))
      .limit(1);

    return author;
  }

  async findOwnedNonExportedCourseIds(authorId: UUIDType) {
    const rows = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(eq(courses.authorId, authorId), ne(courses.originType, COURSE_ORIGIN_TYPES.EXPORTED)),
      );

    return rows.map(({ id }) => id);
  }

  async updateCoursesAuthorMetadata(courseIds: UUIDType[], authorMetadata: CourseAuthorMetadata) {
    if (!courseIds.length) return;

    await this.db.update(courses).set({ authorMetadata }).where(inArray(courses.id, courseIds));
  }

  async updateCourseAuthor(
    courseId: UUIDType,
    authorMetadata: CourseAuthorMetadata,
    db: DatabasePg = this.db,
  ) {
    await db
      .update(courses)
      .set({ authorId: authorMetadata.authorId, authorMetadata })
      .where(eq(courses.id, courseId));
  }

  async updateCourseSummaryStatsAuthor(
    courseId: UUIDType,
    authorId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    await db
      .update(coursesSummaryStats)
      .set({ authorId })
      .where(eq(coursesSummaryStats.courseId, courseId));
  }

  async updateCourseStudentsStatsAuthor(
    courseId: UUIDType,
    authorId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    await db
      .update(courseStudentsStats)
      .set({ authorId })
      .where(eq(courseStudentsStats.courseId, courseId));
  }
}
