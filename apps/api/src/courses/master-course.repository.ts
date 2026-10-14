import { Inject, Injectable } from "@nestjs/common";
import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";
import { and, eq, getTableColumns, ne } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, courses, lessons, masterCourseExports, tenants } from "src/storage/schema";

@Injectable()
export class MasterCourseRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getCourseById(courseId: UUIDType) {
    const [course] = await this.db
      .select({ ...getTableColumns(courses) })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async getTenantManagingStatus(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant;
  }

  async getCourseExportsForManagingTenant(sourceTenantId: UUIDType, sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select({
        id: masterCourseExports.id,
        sourceTenantId: masterCourseExports.sourceTenantId,
        sourceCourseId: masterCourseExports.sourceCourseId,
        targetTenantId: masterCourseExports.targetTenantId,
        targetCourseId: masterCourseExports.targetCourseId,
        syncStatus: masterCourseExports.syncStatus,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
        ),
      );
  }

  async getActiveExportLinksBySourceCourse(sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          ne(masterCourseExports.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED),
        ),
      );
  }

  async findCourseOriginType(courseId: UUIDType) {
    const [course] = await this.db
      .select({ originType: courses.originType })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course?.originType;
  }

  async findCourseIdByChapterId(chapterId: UUIDType) {
    const [chapter] = await this.db
      .select({ courseId: chapters.courseId })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    return chapter?.courseId;
  }

  async findCourseIdByLessonId(lessonId: UUIDType) {
    const [lesson] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    return lesson?.courseId;
  }
}
