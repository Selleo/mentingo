import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, DISCUSSION_SCOPES, FORUM_TOPIC_SORTS } from "@repo/shared";
import { and, asc, count, desc, eq, exists, ilike, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import {
  courseChatMessages,
  courseChatThreads,
  courses,
  studentCourses,
  users,
} from "src/storage/schema";

import type { DiscussionScope, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  ForumPostContext,
  ForumPostRow,
  ForumThreadContext,
  ForumTopicRow,
} from "src/forum/forum.repository.types";
import type { ForumTopicListQuery, ForumTopicVisibility } from "src/forum/forum.types";

const firstPosts = alias(courseChatMessages, "forum_first_posts");

@Injectable()
export class ForumRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findTopics(
    query: ForumTopicListQuery,
    visibility: ForumTopicVisibility,
  ): Promise<{ data: ForumTopicRow[]; totalItems: number }> {
    const visibleTopics = this.db
      .$with("visible_forum_topics")
      .as(
        this.topicQuery(query.language).where(
          and(
            this.visibleTopicCondition(),
            this.topicAccessCondition(visibility),
            query.scope ? eq(courseChatThreads.scope, query.scope) : undefined,
            query.courseId ? eq(courseChatThreads.courseId, query.courseId) : undefined,
            query.search ? this.topicSearchCondition(query.search) : undefined,
          ),
        ),
      );

    const orderBy = match(query.sort)
      .with(FORUM_TOPIC_SORTS.NEWEST, () => [desc(visibleTopics.createdAt), desc(visibleTopics.id)])
      .with(FORUM_TOPIC_SORTS.MOST_REPLIES, () => [
        desc(visibleTopics.replyCount),
        desc(visibleTopics.lastActivityAt),
        desc(visibleTopics.id),
      ])
      .with(FORUM_TOPIC_SORTS.LAST_ACTIVITY, () => [
        desc(visibleTopics.lastActivityAt),
        desc(visibleTopics.id),
      ])
      .exhaustive();

    const [data, [{ totalItems }]] = await Promise.all([
      this.db
        .with(visibleTopics)
        .select()
        .from(visibleTopics)
        .orderBy(...orderBy)
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      this.db.with(visibleTopics).select({ totalItems: count() }).from(visibleTopics),
    ]);

    return { data, totalItems };
  }

  async findTopicById(
    topicId: UUIDType,
    language: SupportedLanguages,
  ): Promise<ForumTopicRow | null> {
    const [topic] = await this.topicQuery(language)
      .where(and(eq(courseChatThreads.id, topicId), eq(courseChatThreads.archived, false)))
      .limit(1);

    return topic ?? null;
  }

  async findThreadContext(threadId: UUIDType): Promise<ForumThreadContext | null> {
    const [thread] = await this.db
      .select({
        id: courseChatThreads.id,
        scope: courseChatThreads.scope,
        courseId: courseChatThreads.courseId,
        firstPostId: firstPosts.id,
        firstPostDeletedAt: firstPosts.deletedAt,
        replyCount: this.replyCountExpression(),
      })
      .from(courseChatThreads)
      .innerJoin(
        firstPosts,
        and(eq(firstPosts.threadId, courseChatThreads.id), isNull(firstPosts.parentMessageId)),
      )
      .where(and(eq(courseChatThreads.id, threadId), eq(courseChatThreads.archived, false)))
      .limit(1);

    return thread ?? null;
  }

  async findPostContext(postId: UUIDType): Promise<ForumPostContext | null> {
    const [post] = await this.db
      .select({
        id: courseChatMessages.id,
        threadId: courseChatMessages.threadId,
        userId: courseChatMessages.userId,
        parentMessageId: courseChatMessages.parentMessageId,
        deletedAt: courseChatMessages.deletedAt,
      })
      .from(courseChatMessages)
      .innerJoin(courseChatThreads, eq(courseChatThreads.id, courseChatMessages.threadId))
      .where(and(eq(courseChatMessages.id, postId), eq(courseChatThreads.archived, false)))
      .limit(1);

    return post ?? null;
  }

  async findReplies(
    firstPostId: UUIDType,
    page: number,
    perPage: number,
  ): Promise<{ data: ForumPostRow[]; totalItems: number }> {
    const visibleRepliesCondition = and(
      eq(courseChatMessages.parentMessageId, firstPostId),
      isNull(courseChatMessages.deletedAt),
    );

    const [data, [{ totalItems }]] = await Promise.all([
      this.db
        .select(this.postSelect())
        .from(courseChatMessages)
        .innerJoin(users, eq(users.id, courseChatMessages.userId))
        .where(visibleRepliesCondition)
        .orderBy(asc(courseChatMessages.createdAt), asc(courseChatMessages.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db
        .select({ totalItems: count() })
        .from(courseChatMessages)
        .where(visibleRepliesCondition),
    ]);

    return { data, totalItems };
  }

  async findPostById(postId: UUIDType): Promise<ForumPostRow | null> {
    const [post] = await this.db
      .select(this.postSelect())
      .from(courseChatMessages)
      .innerJoin(users, eq(users.id, courseChatMessages.userId))
      .where(eq(courseChatMessages.id, postId))
      .limit(1);

    return post ?? null;
  }

  async createGeneralTopic(
    params: { userId: UUIDType; title: string; content: string },
    dbInstance: DatabasePg = this.db,
  ): Promise<UUIDType> {
    const [thread] = await dbInstance
      .insert(courseChatThreads)
      .values({
        scope: DISCUSSION_SCOPES.GENERAL,
        title: params.title,
        createdByUserId: params.userId,
      })
      .returning({ id: courseChatThreads.id });

    await dbInstance.insert(courseChatMessages).values({
      threadId: thread.id,
      userId: params.userId,
      content: params.content,
    });

    return thread.id;
  }

  async createGeneralReply(
    params: { threadId: UUIDType; firstPostId: UUIDType; userId: UUIDType; content: string },
    dbInstance: DatabasePg = this.db,
  ): Promise<UUIDType> {
    const [post] = await dbInstance
      .insert(courseChatMessages)
      .values({
        threadId: params.threadId,
        userId: params.userId,
        content: params.content,
        parentMessageId: params.firstPostId,
      })
      .returning({ id: courseChatMessages.id });

    await dbInstance
      .update(courseChatThreads)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(courseChatThreads.id, params.threadId));

    return post.id;
  }

  private topicQuery(language: SupportedLanguages) {
    return this.db
      .select({
        id: sql<UUIDType>`${courseChatThreads.id}`.as("id"),
        scope: sql<DiscussionScope>`${courseChatThreads.scope}`.as("scope"),
        title: sql<string | null>`${courseChatThreads.title}`.as("title"),
        courseId: sql<UUIDType | null>`${courseChatThreads.courseId}`.as("courseId"),
        courseTitle: sql<string>`${this.localizationService.getLocalizedSqlField(
          courses.title,
          language,
        )}`.as("courseTitle"),
        replyCount: sql<number>`${this.replyCountExpression()}`.as("replyCount"),
        lastActivityAt: sql<string>`${courseChatThreads.updatedAt}`.as("lastActivityAt"),
        createdAt: sql<string>`${courseChatThreads.createdAt}`.as("createdAt"),
        firstPostId: sql<UUIDType>`${firstPosts.id}`.as("firstPostId"),
        firstPostUserId: sql<UUIDType>`${firstPosts.userId}`.as("firstPostUserId"),
        firstPostContent: sql<string>`${firstPosts.content}`.as("firstPostContent"),
        firstPostDeletedAt: sql<string | null>`${firstPosts.deletedAt}`.as("firstPostDeletedAt"),
        firstPostCreatedAt: sql<string>`${firstPosts.createdAt}`.as("firstPostCreatedAt"),
        firstPostUpdatedAt: sql<string>`${firstPosts.updatedAt}`.as("firstPostUpdatedAt"),
        authorFirstName: sql<string>`${users.firstName}`.as("authorFirstName"),
        authorLastName: sql<string>`${users.lastName}`.as("authorLastName"),
        authorAvatarReference: sql<string | null>`${users.avatarReference}`.as(
          "authorAvatarReference",
        ),
      })
      .from(courseChatThreads)
      .innerJoin(
        firstPosts,
        and(eq(firstPosts.threadId, courseChatThreads.id), isNull(firstPosts.parentMessageId)),
      )
      .innerJoin(users, eq(users.id, firstPosts.userId))
      .leftJoin(courses, eq(courses.id, courseChatThreads.courseId));
  }

  private postSelect() {
    return {
      id: courseChatMessages.id,
      threadId: courseChatMessages.threadId,
      userId: courseChatMessages.userId,
      content: courseChatMessages.content,
      parentMessageId: courseChatMessages.parentMessageId,
      deletedAt: courseChatMessages.deletedAt,
      createdAt: courseChatMessages.createdAt,
      updatedAt: courseChatMessages.updatedAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorAvatarReference: users.avatarReference,
    };
  }

  private replyCountExpression() {
    return sql<number>`(
      SELECT COUNT(*)::int
      FROM ${courseChatMessages} forum_replies
      WHERE forum_replies.thread_id = ${courseChatThreads.id}
        AND forum_replies.parent_message_id IS NOT NULL
        AND forum_replies.deleted_at IS NULL
    )`;
  }

  /** A topic whose first post was deleted stays listed only while it still has replies. */
  private visibleTopicCondition() {
    return and(
      eq(courseChatThreads.archived, false),
      or(isNull(firstPosts.deletedAt), sql<boolean>`${this.replyCountExpression()} > 0`),
    );
  }

  private topicAccessCondition(visibility: ForumTopicVisibility) {
    const isGeneralTopic = eq(courseChatThreads.scope, DISCUSSION_SCOPES.GENERAL);

    if (!visibility.includeCourseThreads) return isGeneralTopic;

    return or(
      isGeneralTopic,
      and(
        eq(courseChatThreads.scope, DISCUSSION_SCOPES.COURSE),
        exists(
          this.db
            .select({ id: studentCourses.id })
            .from(studentCourses)
            .where(
              and(
                eq(studentCourses.courseId, courseChatThreads.courseId),
                eq(studentCourses.studentId, visibility.viewerUserId),
                eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
              ),
            ),
        ),
      ),
    );
  }

  private topicSearchCondition(search: string) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;

    return or(
      ilike(courseChatThreads.title, pattern),
      and(isNull(firstPosts.deletedAt), ilike(firstPosts.content, pattern)),
    );
  }
}
