import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { contentMarketplaceCourseLineages, courses } from "src/storage/schema";

import type {
  ContentMarketplaceCourseLineage,
  ContentMarketplaceImportedCourse,
  ContentMarketplaceTrackedCourse,
} from "../content-marketplace.types";
import type { UUIDType } from "src/common";

@Injectable()
export class ContentMarketplaceLineageRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findCourseLineage(
    courseId: UUIDType,
  ): Promise<ContentMarketplaceCourseLineage | undefined> {
    const [lineage] = await this.db
      .select({
        listingId: contentMarketplaceCourseLineages.listingId,
        versionId: contentMarketplaceCourseLineages.versionId,
        acquisitionId: contentMarketplaceCourseLineages.acquisitionId,
      })
      .from(contentMarketplaceCourseLineages)
      .where(eq(contentMarketplaceCourseLineages.courseId, courseId))
      .limit(1);

    return lineage;
  }

  async upsertCourseLineage(courseId: UUIDType, lineage: ContentMarketplaceCourseLineage) {
    const { listingId, versionId, acquisitionId } = lineage;

    await this.db
      .insert(contentMarketplaceCourseLineages)
      .values({ courseId, listingId, versionId, acquisitionId })
      .onConflictDoUpdate({
        target: contentMarketplaceCourseLineages.courseId,
        set: { listingId, versionId, acquisitionId },
      });
  }

  /**
   * Finds the courses the tenant imported from these listings. Duplicates of an imported course
   * share its lineage but have no archive identity, so they are left out.
   */
  async findImportedCourses(listingIds: string[]): Promise<ContentMarketplaceImportedCourse[]> {
    if (!listingIds.length) return [];

    return this.db
      .select({
        courseId: contentMarketplaceCourseLineages.courseId,
        listingId: contentMarketplaceCourseLineages.listingId,
        versionId: contentMarketplaceCourseLineages.versionId,
      })
      .from(contentMarketplaceCourseLineages)
      .innerJoin(courses, eq(courses.id, contentMarketplaceCourseLineages.courseId))
      .where(
        and(
          inArray(contentMarketplaceCourseLineages.listingId, listingIds),
          isNotNull(courses.originalId),
        ),
      );
  }

  /** Imported marketplace courses that are still in use, with the update version admins were last told about. */
  async findTrackedCourses(): Promise<ContentMarketplaceTrackedCourse[]> {
    return this.db
      .select({
        courseId: contentMarketplaceCourseLineages.courseId,
        listingId: contentMarketplaceCourseLineages.listingId,
        versionId: contentMarketplaceCourseLineages.versionId,
        notifiedUpdateVersionId: contentMarketplaceCourseLineages.notifiedUpdateVersionId,
      })
      .from(contentMarketplaceCourseLineages)
      .innerJoin(courses, eq(courses.id, contentMarketplaceCourseLineages.courseId))
      .where(and(isNotNull(courses.originalId), eq(courses.isArchived, false)));
  }

  async hasTrackedCourses(): Promise<boolean> {
    const [trackedCourse] = await this.db
      .select({ id: contentMarketplaceCourseLineages.id })
      .from(contentMarketplaceCourseLineages)
      .innerJoin(courses, eq(courses.id, contentMarketplaceCourseLineages.courseId))
      .where(and(isNotNull(courses.originalId), eq(courses.isArchived, false)))
      .limit(1);

    return Boolean(trackedCourse);
  }

  /**
   * Records that admins were told about this version, only if they were not told already, so
   * concurrent checks notify once. Returns no rows when another check claimed it first.
   */
  async claimCourseUpdateNotification(
    courseId: UUIDType,
    versionId: string,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .update(contentMarketplaceCourseLineages)
      .set({ notifiedUpdateVersionId: versionId })
      .where(
        and(
          eq(contentMarketplaceCourseLineages.courseId, courseId),
          ne(contentMarketplaceCourseLineages.versionId, versionId),
          or(
            isNull(contentMarketplaceCourseLineages.notifiedUpdateVersionId),
            ne(contentMarketplaceCourseLineages.notifiedUpdateVersionId, versionId),
          ),
        ),
      )
      .returning({ courseId: contentMarketplaceCourseLineages.courseId });
  }
}
