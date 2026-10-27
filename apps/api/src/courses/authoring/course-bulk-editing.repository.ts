import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { categories, courses } from "src/storage/schema";

import type { BulkUpdateCourseStatusBody } from "../schemas/bulkUpdateCourseStatus.schema";

@Injectable()
export class CourseBulkEditingRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  /** Returns the selected courses, limited to the author's own when `authorId` is given. */
  async findCoursesForBulkEdit(courseIds: UUIDType[], authorId?: UUIDType) {
    return this.db
      .select({
        id: courses.id,
        status: courses.status,
        isArchived: courses.isArchived,
        categoryId: courses.categoryId,
      })
      .from(courses)
      .where(
        and(inArray(courses.id, courseIds), authorId ? eq(courses.authorId, authorId) : undefined),
      );
  }

  async categoryExists(categoryId: UUIDType) {
    const [category] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId));

    return Boolean(category);
  }

  async updateCoursesStatus(
    courseIds: UUIDType[],
    status: BulkUpdateCourseStatusBody["status"],
    db: DatabasePg,
  ) {
    await db.update(courses).set({ status }).where(inArray(courses.id, courseIds));
  }

  async updateCoursesArchived(courseIds: UUIDType[], isArchived: boolean, db: DatabasePg) {
    await db.update(courses).set({ isArchived }).where(inArray(courses.id, courseIds));
  }

  async updateCoursesCategory(courseIds: UUIDType[], categoryId: UUIDType, db: DatabasePg) {
    await db.update(courses).set({ categoryId }).where(inArray(courses.id, courseIds));
  }
}
