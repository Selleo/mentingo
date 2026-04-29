import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { studentCourseTakeaways } from "src/storage/schema";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseTakeawayService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async getTakeaway(courseId: UUIDType, currentUser: CurrentUserType) {
    const [row] = await this.db
      .select({ content: studentCourseTakeaways.content })
      .from(studentCourseTakeaways)
      .where(
        and(
          eq(studentCourseTakeaways.courseId, courseId),
          eq(studentCourseTakeaways.studentId, currentUser.userId),
        ),
      )
      .limit(1);

    return row?.content ?? "";
  }

  async upsertTakeaway(courseId: UUIDType, content: string, currentUser: CurrentUserType) {
    await this.db
      .insert(studentCourseTakeaways)
      .values({
        courseId,
        studentId: currentUser.userId,
        content,
      })
      .onConflictDoUpdate({
        target: [
          studentCourseTakeaways.tenantId,
          studentCourseTakeaways.studentId,
          studentCourseTakeaways.courseId,
        ],
        set: {
          content,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }
}

