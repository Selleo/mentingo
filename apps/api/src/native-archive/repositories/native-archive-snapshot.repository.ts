import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES } from "@repo/shared";
import { and, eq, inArray } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { userHasPermissionCondition } from "src/common/permissions/permission-sql.utils";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  learningPathCourses,
  learningPaths,
  liveLessons,
  liveTrainings,
  resourceEntity,
  resources,
  userDetails,
  users,
} from "src/storage/schema";

import type { NativeArchiveLearningPathExportRow } from "../native-archive-learning-path.types";
import type { NativeArchivePermission } from "../native-archive.types";

@Injectable()
export class NativeArchiveSnapshotRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findLearningPathById(
    id: UUIDType,
  ): Promise<NativeArchiveLearningPathExportRow | undefined> {
    const [row] = await this.db
      .select({
        id: learningPaths.id,
        originalId: learningPaths.originalId,
        title: learningPaths.title,
        description: learningPaths.description,
        thumbnailReference: learningPaths.thumbnailReference,
        status: learningPaths.status,
        includesCertificate: learningPaths.includesCertificate,
        settings: learningPaths.settings,
        sequenceEnabled: learningPaths.sequenceEnabled,
        authorId: learningPaths.authorId,
        originType: learningPaths.originType,
        baseLanguage: learningPaths.baseLanguage,
        availableLocales: learningPaths.availableLocales,
      })
      .from(learningPaths)
      .where(eq(learningPaths.id, id))
      .limit(1);

    return row;
  }

  findLearningPathCourses(id: UUIDType) {
    return this.db
      .select({
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, id))
      .orderBy(learningPathCourses.displayOrder);
  }

  findLiveLessons(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return [];

    return this.db.select().from(liveLessons).where(inArray(liveLessons.lessonId, lessonIds));
  }

  findLiveTrainings(ids: UUIDType[]) {
    if (!ids.length) return [];

    return this.db.select().from(liveTrainings).where(inArray(liveTrainings.id, ids));
  }

  findCalendarEvents(ids: UUIDType[]) {
    if (!ids.length) return [];

    return this.db.select().from(calendarEvents).where(inArray(calendarEvents.id, ids));
  }

  findTrainingMaterials(ids: UUIDType[]) {
    if (!ids.length) return [];

    return this.db
      .select({
        trainingId: resourceEntity.entityId,
        relationshipType: resourceEntity.relationshipType,
        resource: resources,
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          inArray(resourceEntity.entityId, ids),
          eq(resourceEntity.entityType, ENTITY_TYPES.LIVE_TRAINING),
        ),
      );
  }

  async findCourseAuthorMetadata(id: UUIDType) {
    const [row] = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        jobTitle: userDetails.jobTitle,
        description: userDetails.description,
        profilePictureReference: users.avatarReference,
      })
      .from(users)
      .leftJoin(userDetails, eq(userDetails.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);

    return row;
  }

  async findUserManagePermissions(
    userId: UUIDType,
    globalPermission: NativeArchivePermission,
    ownPermission: NativeArchivePermission,
  ) {
    const [row] = await this.db
      .select({
        global: userHasPermissionCondition(this.db, users.id, users.tenantId, globalPermission),
        own: userHasPermissionCondition(this.db, users.id, users.tenantId, ownPermission),
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row;
  }
}
