import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { courses, courseStudentMode } from "src/storage/schema";

@Injectable()
export class CourseStudentModeRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async courseExists(courseId: UUIDType) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId));

    return Boolean(course);
  }

  async insertStudentModeEntry(courseId: UUIDType, userId: UUIDType, db: DatabasePg = this.db) {
    await db.insert(courseStudentMode).values({ userId, courseId }).onConflictDoNothing();
  }

  async deleteStudentModeEntry(courseId: UUIDType, userId: UUIDType, db: DatabasePg = this.db) {
    await db
      .delete(courseStudentMode)
      .where(and(eq(courseStudentMode.userId, userId), eq(courseStudentMode.courseId, courseId)));
  }

  async findStudentModeCourseIds(userId: UUIDType, db: DatabasePg = this.db) {
    const rows = await db
      .select({ courseId: courseStudentMode.courseId })
      .from(courseStudentMode)
      .where(eq(courseStudentMode.userId, userId));

    return rows.map(({ courseId }) => courseId);
  }

  async hasStudentModeEntry(courseId: UUIDType, userId: UUIDType, db: DatabasePg = this.db) {
    const [entry] = await db
      .select({ id: courseStudentMode.id })
      .from(courseStudentMode)
      .where(and(eq(courseStudentMode.courseId, courseId), eq(courseStudentMode.userId, userId)));

    return Boolean(entry);
  }
}
