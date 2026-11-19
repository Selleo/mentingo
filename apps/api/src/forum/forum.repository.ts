import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, DISCUSSION_SCOPES, FORUM_TOPIC_SORTS, PERMISSIONS } from "@repo/shared";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";

import { DatabasePg } from "src/common";
import { userHasPermissionCondition } from "src/common/permissions/permission-sql.utils";
import { LocalizationService } from "src/localization/localization.service";
import {
  courseChatMessages,
  courseChatThreads,
  courses,
  settings,
  studentCourses,
  users,
} from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  CourseChatUserProfileRow,
  DiscussionEmailRecipient,
} from "src/course-chat/course-chat.repository.types";
import type {
  ForumCourseDiscussionRow,
  ForumPostContext,
  ForumPostRow,
  ForumThreadContext,
  ForumTopicRow,
} from "src/forum/forum.repository.types";
import type { ForumCourseDiscussionListQuery, ForumTopicListQuery } from "src/forum/forum.types";

const firstPosts = alias(courseChatMessages, "forum_first_posts");

@Injectable()
export class ForumRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findTopics(
    query: ForumTopicListQuery,
  ): Promise<{ data: ForumTopicRow[]; totalItems: number }> {
    const visibleTopics = this.db
      .$with("visible_forum_topics")
      .as(
        this.topicQuery().where(
          and(
            this.visibleTopicCondition(),
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

  async findTopicById(topicId: UUIDType): Promise<ForumTopicRow | null> {
    const [topic] = await this.topicQuery()
      .where(and(eq(courseChatThreads.id, topicId), this.forumTopicCondition()))
      .limit(1);

    return topic ?? null;
  }

  async findThreadContext(threadId: UUIDType): Promise<ForumThreadContext | null> {
    const [thread] = await this.db
      .select({
        id: courseChatThreads.id,
        firstPostId: firstPosts.id,
        firstPostDeletedAt: firstPosts.deletedAt,
        replyCount: this.replyCountExpression(),
      })
      .from(courseChatThreads)
      .innerJoin(
        firstPosts,
        and(eq(firstPosts.threadId, courseChatThreads.id), isNull(firstPosts.parentMessageId)),
      )
      .where(and(eq(courseChatThreads.id, threadId), this.forumTopicCondition()))
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
      .where(and(eq(courseChatMessages.id, postId), this.forumTopicCondition()))
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
  ): Promise<{ topicId: UUIDType; postId: UUIDType }> {
    const [thread] = await dbInstance
      .insert(courseChatThreads)
      .values({
        scope: DISCUSSION_SCOPES.GENERAL,
        title: params.title,
        createdByUserId: params.userId,
      })
      .returning({ id: courseChatThreads.id });

    const [post] = await dbInstance
      .insert(courseChatMessages)
      .values({
        threadId: thread.id,
        userId: params.userId,
        content: params.content,
      })
      .returning({ id: courseChatMessages.id });

    return { topicId: thread.id, postId: post.id };
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

  async findMentionableUsers(userIds?: UUIDType[]): Promise<CourseChatUserProfileRow[]> {
    if (userIds && !userIds.length) return [];

    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(this.forumReaderCondition(userIds))
      .orderBy(users.firstName, users.lastName);
  }

  async findEmailRecipients(userIds: UUIDType[]): Promise<DiscussionEmailRecipient[]> {
    if (!userIds.length) return [];

    return this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: sql<string | null>`${settings.settings}->>'language'`,
      })
      .from(users)
      .leftJoin(settings, eq(settings.userId, users.id))
      .where(this.forumReaderCondition(userIds));
  }

  async findCourseDiscussions(
    viewerUserId: UUIDType,
    query: ForumCourseDiscussionListQuery,
  ): Promise<{ data: ForumCourseDiscussionRow[]; totalItems: number }> {
    const courseDiscussions = this.db
      .$with("forum_course_discussions")
      .as(
        this.courseDiscussionQuery(viewerUserId, query.language, { search: query.search }).having(
          sql`COUNT(${courseChatMessages.id}) > 0`,
        ),
      );

    const rows = await this.db
      .with(courseDiscussions)
      .select({
        courseId: courseDiscussions.courseId,
        courseTitle: courseDiscussions.courseTitle,
        messageCount: courseDiscussions.messageCount,
        lastActivityAt: courseDiscussions.lastActivityAt,
        totalItems: sql<number>`(COUNT(*) OVER())::int`,
      })
      .from(courseDiscussions)
      .orderBy(desc(courseDiscussions.lastActivityAt), desc(courseDiscussions.courseId))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const data = rows.map(({ courseId, courseTitle, messageCount, lastActivityAt }) => ({
      courseId,
      courseTitle,
      messageCount,
      lastActivityAt,
    }));
    const [firstRow] = rows;

    if (firstRow) return { data, totalItems: firstRow.totalItems };

    if (query.page === 1) return { data, totalItems: 0 };

    const [{ totalItems }] = await this.db
      .with(courseDiscussions)
      .select({ totalItems: count() })
      .from(courseDiscussions);

    return { data, totalItems };
  }

  async findCourseDiscussion(
    courseId: UUIDType,
    viewerUserId: UUIDType,
    language: SupportedLanguages,
  ): Promise<ForumCourseDiscussionRow | null> {
    const [courseDiscussion] = await this.courseDiscussionQuery(viewerUserId, language, {
      courseId,
    });

    return courseDiscussion ?? null;
  }

  async findTopicTitle(topicId: UUIDType): Promise<string | null> {
    const [topic] = await this.db
      .select({ title: courseChatThreads.title })
      .from(courseChatThreads)
      .where(eq(courseChatThreads.id, topicId))
      .limit(1);

    return topic?.title ?? null;
  }

  async findUserFullName(userId: UUIDType): Promise<string | null> {
    const [user] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ? `${user.firstName} ${user.lastName}` : null;
  }

  private courseDiscussionQuery(
    viewerUserId: UUIDType,
    language: SupportedLanguages,
    filter: { courseId?: UUIDType; search?: string },
  ) {
    const courseTitle = this.localizationService.getLocalizedSqlField(courses.title, language);

    return this.db
      .select({
        courseId: courses.id,
        courseTitle: sql<string>`${courseTitle}`.as("courseTitle"),
        messageCount: sql<number>`COUNT(${courseChatMessages.id})::int`.as("messageCount"),
        lastActivityAt: sql<string | null>`MAX(${courseChatMessages.createdAt})`.as(
          "lastActivityAt",
        ),
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .leftJoin(
        courseChatThreads,
        and(
          eq(courseChatThreads.courseId, courses.id),
          eq(courseChatThreads.scope, DISCUSSION_SCOPES.COURSE),
          eq(courseChatThreads.archived, false),
        ),
      )
      .leftJoin(
        courseChatMessages,
        and(
          eq(courseChatMessages.threadId, courseChatThreads.id),
          isNull(courseChatMessages.deletedAt),
        ),
      )
      .where(
        and(
          eq(studentCourses.studentId, viewerUserId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          filter.courseId ? eq(courses.id, filter.courseId) : undefined,
          filter.search
            ? this.localizationService.getLocalizedFieldSearchCondition(
                courses.title,
                this.toSearchPattern(filter.search),
                language,
                { baseTable: courses, fallbackToBaseLanguage: true },
              )
            : undefined,
        ),
      )
      .groupBy(courses.id);
  }

  private topicQuery() {
    return this.db
      .select({
        id: sql<UUIDType>`${courseChatThreads.id}`.as("id"),
        title: sql<string>`${courseChatThreads.title}`.as("title"),
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
      .innerJoin(users, eq(users.id, firstPosts.userId));
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

  private forumReaderCondition(userIds?: UUIDType[]) {
    return and(
      isNull(users.deletedAt),
      eq(users.archived, false),
      userHasPermissionCondition(this.db, users.id, users.tenantId, PERMISSIONS.FORUM_READ),
      userIds ? inArray(users.id, userIds) : undefined,
    );
  }

  private forumTopicCondition() {
    return and(
      eq(courseChatThreads.scope, DISCUSSION_SCOPES.GENERAL),
      eq(courseChatThreads.archived, false),
    );
  }

  /** A topic whose first post was deleted stays listed only while it still has replies. */
  private visibleTopicCondition() {
    return and(
      this.forumTopicCondition(),
      or(isNull(firstPosts.deletedAt), sql<boolean>`${this.replyCountExpression()} > 0`),
    );
  }

  private toSearchPattern(search: string) {
    return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  }

  private topicSearchCondition(search: string) {
    const pattern = this.toSearchPattern(search);

    return or(
      ilike(courseChatThreads.title, pattern),
      and(isNull(firstPosts.deletedAt), ilike(firstPosts.content, pattern)),
    );
  }
}
