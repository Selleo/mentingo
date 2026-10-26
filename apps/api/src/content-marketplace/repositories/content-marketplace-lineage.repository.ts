import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { contentMarketplaceCourseLineages, courses } from "src/storage/schema";

import type {
  ContentMarketplaceCourseLineage,
  ContentMarketplaceImportedCourse,
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
}
