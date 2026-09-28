import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { userHasPermissionCondition } from "src/common/permissions/permission-sql.utils";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  chapters,
  courses,
  learningPathCourses,
  learningPaths,
  lessons,
  liveLessons,
  liveTrainingLinks,
  liveTrainings,
  resourceEntity,
  resources,
  users,
} from "src/storage/schema";

import type {
  NativeArchiveCalendarEventInsert,
  NativeArchiveCourseInsert,
  NativeArchiveLearningPathInsert,
  NativeArchiveResourceInsert,
} from "./native-archive-import.repository.types";
import type { NativeArchivePermission } from "../native-archive.types";

@Injectable()
export class NativeArchiveImportRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findLearningPathById(id: UUIDType) {
    const rows = await this.db
      .select({ id: learningPaths.id })
      .from(learningPaths)
      .where(eq(learningPaths.id, id))
      .limit(1);

    return rows[0];
  }

  async findUserPermission(userId: UUIDType, permission: NativeArchivePermission) {
    const [row] = await this.db
      .select({
        allowed: userHasPermissionCondition(this.db, users.id, users.tenantId, permission),
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row;
  }

  createCourse(values: NativeArchiveCourseInsert) {
    const { title, description } = values;

    return this.db.insert(courses).values({
      ...values,
      title: buildJsonbFieldWithMultipleEntries(title),
      description: buildJsonbFieldWithMultipleEntries(description),
    });
  }

  createLearningPath(values: NativeArchiveLearningPathInsert) {
    const { title, description } = values;

    return this.db.insert(learningPaths).values({
      ...values,
      title: buildJsonbFieldWithMultipleEntries(title),
      description: buildJsonbFieldWithMultipleEntries(description),
    });
  }

  createLearningPathCourses(values: (typeof learningPathCourses.$inferInsert)[]) {
    return this.db.insert(learningPathCourses).values(values);
  }

  async findLiveTrainingById(id: UUIDType) {
    const [row] = await this.db
      .select({ authorId: liveTrainings.authorId, metadata: liveTrainings.metadata })
      .from(liveTrainings)
      .where(eq(liveTrainings.id, id))
      .limit(1);

    return row;
  }

  updateLiveTrainingMetadata(id: UUIDType, metadata: typeof liveTrainings.$inferInsert.metadata) {
    return this.db.update(liveTrainings).set({ metadata }).where(eq(liveTrainings.id, id));
  }

  async createCalendarEvent(values: NativeArchiveCalendarEventInsert): Promise<UUIDType> {
    const { title, description } = values;

    const [row] = await this.db
      .insert(calendarEvents)
      .values({
        ...values,
        title: buildJsonbFieldWithMultipleEntries(title),
        description: description ? buildJsonbFieldWithMultipleEntries(description) : undefined,
      })
      .returning({ id: calendarEvents.id });

    return row.id;
  }

  async createLiveTraining(values: typeof liveTrainings.$inferInsert): Promise<UUIDType> {
    const [row] = await this.db
      .insert(liveTrainings)
      .values(values)
      .returning({ id: liveTrainings.id });

    return row.id;
  }

  async createLiveTrainingLink(values: typeof liveTrainingLinks.$inferInsert): Promise<UUIDType> {
    const [row] = await this.db
      .insert(liveTrainingLinks)
      .values(values)
      .returning({ id: liveTrainingLinks.id });

    return row.id;
  }

  async createResource(values: NativeArchiveResourceInsert): Promise<UUIDType> {
    const { title, description } = values;
    const [row] = await this.db
      .insert(resources)
      .values({
        ...values,
        title: buildJsonbFieldWithMultipleEntries(title),
        description: buildJsonbFieldWithMultipleEntries(description),
      })
      .returning({ id: resources.id });

    return row.id;
  }

  createResourceEntity(values: typeof resourceEntity.$inferInsert) {
    return this.db.insert(resourceEntity).values(values);
  }

  async createLesson(values: typeof lessons.$inferInsert): Promise<UUIDType> {
    const [row] = await this.db.insert(lessons).values(values).returning({ id: lessons.id });

    return row.id;
  }

  createLiveLesson(values: typeof liveLessons.$inferInsert) {
    return this.db.insert(liveLessons).values(values);
  }

  updateChapterLessonCount(id: UUIDType, lessonCount: number) {
    return this.db.update(chapters).set({ lessonCount }).where(eq(chapters.id, id));
  }
}
