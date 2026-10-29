import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { and, desc, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { DB } from "src/storage/db/db.providers";
import { resourceEntity, resources } from "src/storage/schema";

@Injectable()
export class CourseMediaRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  /** Active trailer references for the courses, newest first. */
  async findTrailerReferences(courseIds: UUIDType[]) {
    if (!courseIds.length) return [];

    return this.db
      .select({
        courseId: resourceEntity.entityId,
        reference: resources.reference,
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.TRAILER),
          inArray(resourceEntity.entityId, courseIds),
          eq(resources.archived, false),
        ),
      )
      .orderBy(desc(resources.createdAt));
  }
}
