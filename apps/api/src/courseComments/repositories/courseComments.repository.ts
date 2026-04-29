import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { courseComments, courses, users } from "src/storage/schema";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "src/storage/schema";

type Tx = PostgresJsDatabase<typeof schema>;

export type CourseCommentRow = {
  id: UUIDType;
  courseId: UUIDType;
  parentCommentId: UUIDType | null;
  authorId: UUIDType;
  content: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarReference: string | null;
};

const baseSelect = {
  id: courseComments.id,
  courseId: courseComments.courseId,
  parentCommentId: courseComments.parentCommentId,
  authorId: courseComments.authorId,
  content: courseComments.content,
  replyCount: courseComments.replyCount,
  createdAt: courseComments.createdAt,
  updatedAt: courseComments.updatedAt,
  deletedAt: courseComments.deletedAt,
  authorFirstName: users.firstName,
  authorLastName: users.lastName,
  authorAvatarReference: users.avatarReference,
};

@Injectable()
export class CourseCommentsRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findCourse(courseId: UUIDType) {
    const [course] = await this.db
      .select({ id: courses.id, authorId: courses.authorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async findCommentById(id: UUIDType): Promise<CourseCommentRow | undefined> {
    const [row] = await this.db
      .select(baseSelect)
      .from(courseComments)
      .leftJoin(users, eq(users.id, courseComments.authorId))
      .where(eq(courseComments.id, id))
      .limit(1);
    return row;
  }

  async listTopLevel(
    courseId: UUIDType,
    limit: number,
    cursor?: { createdAt: string; id: string },
  ): Promise<CourseCommentRow[]> {
    const whereClause = and(
      eq(courseComments.courseId, courseId),
      isNull(courseComments.parentCommentId),
      cursor
        ? or(
            lt(courseComments.createdAt, cursor.createdAt),
            and(eq(courseComments.createdAt, cursor.createdAt), lt(courseComments.id, cursor.id)),
          )
        : undefined,
    );

    return this.db
      .select(baseSelect)
      .from(courseComments)
      .leftJoin(users, eq(users.id, courseComments.authorId))
      .where(whereClause)
      .orderBy(desc(courseComments.createdAt), desc(courseComments.id))
      .limit(limit);
  }

  async listInlinedReplies(
    parentIds: UUIDType[],
    limitPerParent: number,
  ): Promise<CourseCommentRow[]> {
    if (parentIds.length === 0) return [];

    const ranked = this.db
      .select({
        ...baseSelect,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${courseComments.parentCommentId} ORDER BY ${courseComments.createdAt} ASC, ${courseComments.id} ASC)`.as(
          "rn",
        ),
      })
      .from(courseComments)
      .leftJoin(users, eq(users.id, courseComments.authorId))
      .where(inArray(courseComments.parentCommentId, parentIds))
      .as("ranked");

    return this.db
      .select({
        id: ranked.id,
        courseId: ranked.courseId,
        parentCommentId: ranked.parentCommentId,
        authorId: ranked.authorId,
        content: ranked.content,
        replyCount: ranked.replyCount,
        createdAt: ranked.createdAt,
        updatedAt: ranked.updatedAt,
        deletedAt: ranked.deletedAt,
        authorFirstName: ranked.authorFirstName,
        authorLastName: ranked.authorLastName,
        authorAvatarReference: ranked.authorAvatarReference,
      })
      .from(ranked)
      .where(sql`${ranked.rn} <= ${limitPerParent}`);
  }

  async listReplies(
    parentId: UUIDType,
    limit: number,
    cursor?: { createdAt: string; id: string },
  ): Promise<CourseCommentRow[]> {
    const whereClause = and(
      eq(courseComments.parentCommentId, parentId),
      cursor
        ? or(
            gt(courseComments.createdAt, cursor.createdAt),
            and(eq(courseComments.createdAt, cursor.createdAt), gt(courseComments.id, cursor.id)),
          )
        : undefined,
    );

    return this.db
      .select(baseSelect)
      .from(courseComments)
      .leftJoin(users, eq(users.id, courseComments.authorId))
      .where(whereClause)
      .orderBy(asc(courseComments.createdAt), asc(courseComments.id))
      .limit(limit);
  }

  async createComment(
    values: {
      courseId: UUIDType;
      authorId: UUIDType;
      parentCommentId: UUIDType | null;
      content: string;
    },
    tx: Tx = this.db,
  ): Promise<CourseCommentRow> {
    const [inserted] = await tx.insert(courseComments).values(values).returning({
      id: courseComments.id,
      courseId: courseComments.courseId,
      parentCommentId: courseComments.parentCommentId,
      authorId: courseComments.authorId,
      content: courseComments.content,
      replyCount: courseComments.replyCount,
      createdAt: courseComments.createdAt,
      updatedAt: courseComments.updatedAt,
      deletedAt: courseComments.deletedAt,
    });

    const [author] = await tx
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(eq(users.id, values.authorId))
      .limit(1);

    return {
      ...inserted,
      authorFirstName: author?.firstName ?? null,
      authorLastName: author?.lastName ?? null,
      authorAvatarReference: author?.avatarReference ?? null,
    };
  }

  async incrementReplyCount(commentId: UUIDType, tx: Tx = this.db) {
    await tx
      .update(courseComments)
      .set({ replyCount: sql`${courseComments.replyCount} + 1` })
      .where(eq(courseComments.id, commentId));
  }

  async decrementReplyCount(commentId: UUIDType, tx: Tx = this.db) {
    await tx
      .update(courseComments)
      .set({
        replyCount: sql`GREATEST(${courseComments.replyCount} - 1, 0)`,
      })
      .where(eq(courseComments.id, commentId));
  }

  async updateContent(commentId: UUIDType, content: string) {
    const [updated] = await this.db
      .update(courseComments)
      .set({ content })
      .where(eq(courseComments.id, commentId))
      .returning();
    return updated;
  }

  async softDelete(commentId: UUIDType, tx: Tx = this.db) {
    const [updated] = await tx
      .update(courseComments)
      .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(courseComments.id, commentId))
      .returning();
    return updated;
  }

  async hardDelete(commentId: UUIDType, tx: Tx = this.db) {
    await tx.delete(courseComments).where(eq(courseComments.id, commentId));
  }

  async countNonDeletedForCourse(courseId: UUIDType): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courseComments)
      .where(and(eq(courseComments.courseId, courseId), isNull(courseComments.deletedAt)));
    return row?.count ?? 0;
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>) {
    return this.db.transaction(fn);
  }
}
