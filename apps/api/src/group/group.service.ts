import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  countDistinct,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { GroupSortFields } from "src/group/group.schema";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  groups,
  groupUsers,
  users,
  groupCourses,
  studentCourses,
  chapters,
  studentChapterProgress, lessons, studentLessonProgress,
} from "src/storage/schema";

import type { SQL } from "drizzle-orm";
import type { PaginatedResponse, Pagination, UUIDType } from "src/common";
import type { GroupSortField, GroupKeywordFilterBody } from "src/group/group.schema";
import type {
  AllGroupsResponse,
  UpsertGroupBody,
  GroupsQuery,
  GroupResponse,
} from "src/group/group.types";
import type { UserResponse } from "src/user/schemas/user.schema";

@Injectable()
export class GroupService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getAllGroups(
    query: GroupsQuery = {},
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const {
      filters = {},
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      sort = GroupSortFields.createdAt,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);
    const conditions = this.getFiltersConditions(filters);

    return this.db.transaction(async (trx) => {
      const queryDB = trx
        .select({
          ...getTableColumns(groups),
          users: sql<UserResponse[]>`
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', u.id,
                    'createdAt', u.created_at,
                    'updatedAt', u.updated_at,
                    'email', u.email,
                    'firstName', u.first_name,
                    'lastName', u.last_name,
                    'role', u.role,
                    'archived', u.archived,
                    'profilePictureUrl', u.avatar_reference,
                    'deletedAt', u.deleted_at
                  )
                )
                FROM users u
                INNER JOIN group_users gu ON u.id = gu.user_id
                WHERE gu.group_id = groups.id
              ),
              '[]'::json
            )
          `,
        })
        .from(groups)
        .where(and(...conditions))
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as GroupSortField)));

      const dynamicQuery = queryDB.$dynamic();
      const paginatedQuery = addPagination(dynamicQuery, page, perPage);
      const data = await paginatedQuery;

      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(groups.id) })
        .from(groups)
        .where(and(...conditions));

      return {
        data,
        pagination: {
          totalItems,
          page,
          perPage,
        },
      };
    });
  }

  public async getGroupById(groupId: UUIDType): Promise<{ data: GroupResponse }> {
    const [group] = await this.db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId)));
    return {
      data: group,
    };
  }

  async getUserGroups(
    query: GroupsQuery,
    userId: UUIDType,
  ): Promise<{ data: AllGroupsResponse; pagination: Pagination }> {
    const {
      filters = {},
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      sort = GroupSortFields.createdAt,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db.transaction(async (trx) => {
      const conditions = [eq(groupUsers.userId, userId), ...this.getFiltersConditions(filters)];

      const queryDB = trx
        .select({
          id: groups.id,
          name: groups.name,
          characteristic: groups.characteristic,
          createdAt: groups.createdAt,
          updatedAt: groups.updatedAt,
        })
        .from(groupUsers)
        .innerJoin(groups, eq(groups.id, groupUsers.groupId))
        .where(and(...conditions))
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as GroupSortField)));

      const dynamicQuery = queryDB.$dynamic();
      const paginatedQuery = addPagination(dynamicQuery, page, perPage);
      const data = await paginatedQuery;

      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(groups.id) })
        .from(groupUsers)
        .innerJoin(groups, eq(groups.id, groupUsers.groupId))
        .where(and(...conditions));

      return {
        data,
        pagination: {
          totalItems,
          page,
          perPage,
        },
      };
    });
  }

  public async createGroup(createGroupBody: UpsertGroupBody) {
    const [createdGroup] = await this.db.insert(groups).values(createGroupBody).returning();

    if (!createdGroup) throw new ConflictException("Unable to create group");

    return createdGroup;
  }

  public async updateGroup(groupId: UUIDType, updateGroupBody: UpsertGroupBody) {
    const [existingGroup] = await this.db.select().from(groups).where(eq(groups.id, groupId));

    if (!existingGroup) {
      throw new NotFoundException("Group not found");
    }

    const [updatedGroup] = await this.db
      .update(groups)
      .set(updateGroupBody)
      .where(eq(groups.id, groupId))
      .returning();

    return updatedGroup;
  }

  public async deleteGroup(groupId: UUIDType) {
    const [deletedGroup] = await this.db.delete(groups).where(eq(groups.id, groupId)).returning();

    if (!deletedGroup) {
      throw new NotFoundException("Group not found");
    }
  }

  public async bulkDeleteGroups(groupIds: UUIDType[]) {
    if (groupIds.length === 0) {
      throw new BadRequestException("Groups not found");
    }

    await this.db.delete(groups).where(inArray(groups.id, groupIds)).returning();
  }

  async setUserGroups(groupIds: UUIDType[], userId: UUIDType, db: DatabasePg = this.db) {
    return db.transaction(async (trx) => {
      const [user] = await trx.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));

      if (!user) {
        throw new NotFoundException("User not found");
      }

      await trx.delete(groupUsers).where(eq(groupUsers.userId, userId));

      if (groupIds.length === 0) return;

      const existingGroups = await trx
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, groupIds));

      if (existingGroups.length !== groupIds.length)
        throw new BadRequestException("One or more groups doesn't exist");
      
      if (existingGroups.length > 0) {
        const groupsToAssign = existingGroups.map((group) => ({ userId, groupId: group.id }))
        
        await trx
          .insert(groupUsers)
          .values(groupsToAssign)
          .returning();

        await Promise.all((existingGroups.map((group) => this.enrollUserToGroupCourses(userId, group.id, trx))));
      }
      
      return;
    });
  }

  private getFiltersConditions(filters: GroupKeywordFilterBody) {
    const conditions = [];

    if (filters.keyword) {
      conditions.push(
        or(
          ilike(groups.name, `%${filters.keyword.toLowerCase()}%`),
          ilike(groups.characteristic, `%${filters.keyword.toLowerCase()}%`),
        ) as SQL,
      );
    }

    return conditions ?? [sql`1=1`];
  }

  private getColumnToSortBy(sort: GroupSortField) {
    switch (sort) {
      default:
        return groups.createdAt;
    }
  }

  async getGroupsByCourse(courseId: UUIDType) {
    return this.db
      .select({
        id: groups.id,
        name: groups.name,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groupCourses)
      .innerJoin(groups, eq(groups.id, groupCourses.groupId))
      .where(eq(groupCourses.courseId, courseId));
  }

  private async enrollUserToGroupCourses(
    userId: UUIDType,
    groupId: UUIDType,
    trx: any,
  ): Promise<void> {
    const groupCoursesList = await trx
      .select({ courseId: groupCourses.courseId })
      .from(groupCourses)
      .where(eq(groupCourses.groupId, groupId));

    if (groupCoursesList.length === 0) return;

    const existingEnrollments = await trx
      .select({ courseId: studentCourses.courseId })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, userId),
          inArray(
            studentCourses.courseId,
            groupCoursesList.map((gc: any) => gc.courseId),
          ),
        ),
      );

    const existingCourseIds = existingEnrollments.map((e: any) => e.courseId);
    const newCourseIds = groupCoursesList
      .map((gc: any) => gc.courseId)
      .filter((courseId: any) => !existingCourseIds.includes(courseId));

    if (newCourseIds.length === 0) return;

    const studentCoursesValues = newCourseIds.map((courseId: any) => ({
      studentId: userId,
      courseId,
      enrolledByGroupId: groupId,
    }));

    await trx.insert(studentCourses).values(studentCoursesValues);

    for (const courseId of newCourseIds) {
      const courseChapters = await trx
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.courseId, courseId));

      if (courseChapters.length === 0) continue;

      await trx.insert(studentChapterProgress).values(
        courseChapters.map((chapter: any) => ({
          studentId: userId,
          chapterId: chapter.id,
          courseId,
          completedLessonItemCount: 0,
        })),
      );

      for (const chapter of courseChapters) {
        const chapterLessons = await trx
          .select({ id: lessons.id, type: lessons.type })
          .from(lessons)
          .where(eq(lessons.chapterId, chapter.id));

        if (chapterLessons.length === 0) continue;

        await trx.insert(studentLessonProgress).values(
          chapterLessons.map((lesson: any) => ({
            studentId: userId,
            lessonId: lesson.id,
            chapterId: chapter.id,
            completedQuestionCount: 0,
            quizScore: lesson.type === LESSON_TYPES.QUIZ ? 0 : null,
            completedAt: null,
          })),
        );
      }
    }
  }
}
