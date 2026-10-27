import { Inject, Injectable } from "@nestjs/common";
import { SCORM_PACKAGE_ENTITY_TYPE } from "@repo/shared";
import { and, eq, getTableColumns, inArray, or } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  coursesSummaryStats,
  lessons,
  scormPackages,
  studentChapterProgress,
  studentCourses,
} from "src/storage/schema";

@Injectable()
export class CourseDeletionRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findCoursesWithTitle(courseIds: UUIDType[]) {
    return this.db
      .select({
        ...getTableColumns(courses),
        courseTitle: this.localizationService.getLocalizedSqlField(courses.title),
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));
  }

  /** Deletes SCORM packages attached to the courses or to any of their lessons. */
  async deleteScormPackagesForCourses(courseIds: UUIDType[], db: DatabasePg) {
    const courseLessonIds = db
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(inArray(chapters.courseId, courseIds));

    const deleted = await db
      .delete(scormPackages)
      .where(
        or(
          and(
            eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
            inArray(scormPackages.entityId, courseIds),
          ),
          and(
            eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
            inArray(scormPackages.entityId, courseLessonIds),
          ),
        ),
      )
      .returning({ id: scormPackages.id });

    return deleted.map(({ id }) => id);
  }

  async deleteStudentCourses(courseIds: UUIDType[], db: DatabasePg) {
    await db.delete(studentCourses).where(inArray(studentCourses.courseId, courseIds));
  }

  async deleteStudentChapterProgress(courseIds: UUIDType[], db: DatabasePg) {
    await db
      .delete(studentChapterProgress)
      .where(inArray(studentChapterProgress.courseId, courseIds));
  }

  async deleteCoursesSummaryStats(courseIds: UUIDType[], db: DatabasePg) {
    await db.delete(coursesSummaryStats).where(inArray(coursesSummaryStats.courseId, courseIds));
  }

  async deleteCourses(courseIds: UUIDType[], db: DatabasePg) {
    return db.delete(courses).where(inArray(courses.id, courseIds)).returning();
  }
}
