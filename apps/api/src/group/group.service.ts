import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, countDistinct, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { GroupSortFields } from "src/group/group.schema";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  chapters,
  groupCourses,
  groups,
  groupUsers,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { SQL } from "drizzle-orm";
import type { PaginatedResponse, Pagination, UUIDType } from "src/common";
import type { GroupSortField } from "src/group/group.schema";
import type {
  AllGroupsResponse,
  UpsertGroupBody,
  GroupsFilterSchema,
  GroupsQuery,
  GroupResponse,
} from "src/group/group.types";

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
        .select()
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

  async assignUserToGroup(groupId: UUIDType, userId: UUIDType) {
    // Check if group exists
    const [group] = await this.db.select().from(groups).where(eq(groups.id, groupId));
    if (!group) throw new NotFoundException("Group not found");

    // Check if user exists and is a student
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== USER_ROLES.STUDENT) throw new ConflictException("User is not a student");

    const [existingAssociation] = await this.db
      .select()
      .from(groupUsers)
      .where(
        and(
          eq(groupUsers.groupId, groupId),
          eq(groupUsers.userId, userId),
          isNull(users.deletedAt),
        ),
      );

    if (existingAssociation) throw new ConflictException("User already assigned to the group");

    await this.db.transaction(async (trx) => {
      // Assign user to group
      const [assigned] = await trx.insert(groupUsers).values({ userId, groupId }).returning();

      if (!assigned) throw new ConflictException("Unable to assign user to the group");

      // Auto-enroll user to all courses the group is enrolled in
      await this.enrollUserToGroupCourses(userId, groupId, trx);
    });

    return;
  }

  private async enrollUserToGroupCourses(
    userId: UUIDType,
    groupId: UUIDType,
    trx: any,
  ): Promise<void> {
    // Get all courses the group is enrolled in
    const groupCoursesList = await trx
      .select({ courseId: groupCourses.courseId })
      .from(groupCourses)
      .where(eq(groupCourses.groupId, groupId));

    if (groupCoursesList.length === 0) return;

    // Check which courses the user is already enrolled in
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

    // Insert student course enrollments
    const studentCoursesValues = newCourseIds.map((courseId: any) => ({
      studentId: userId,
      courseId,
      enrolledByGroupId: groupId,
    }));

    await trx.insert(studentCourses).values(studentCoursesValues);

    // Create course dependencies for each course
    for (const courseId of newCourseIds) {
      // Get course chapters
      const courseChapters = await trx
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.courseId, courseId));

      if (courseChapters.length === 0) continue;

      // Create chapter progress
      await trx.insert(studentChapterProgress).values(
        courseChapters.map((chapter: any) => ({
          studentId: userId,
          chapterId: chapter.id,
          courseId,
          completedLessonItemCount: 0,
        })),
      );

      // Create lesson progress for each chapter
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

  async unassignUserFromGroup(groupId: UUIDType, userId: UUIDType) {
    const [assigned] = await this.db
      .select()
      .from(groupUsers)
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .where(
        and(
          eq(groupUsers.groupId, groupId),
          eq(groupUsers.userId, userId),
          isNull(users.deletedAt),
        ),
      );

    if (!assigned) throw new ConflictException("User is not assigned to this group");

    const [unassigned] = await this.db
      .delete(groupUsers)
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.groupId, groupId)))
      .returning();

    if (!unassigned) throw new ConflictException("Unable to unassign from the group");

    return;
  }

  private getFiltersConditions(filters: GroupsFilterSchema) {
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
      case GroupSortFields.createdAt:
        return groups.createdAt;
      case GroupSortFields.name:
        return groups.name;
      default:
        return groups.createdAt;
    }
  }

  async getGroupsByCourse(courseId: UUIDType) {
    const enrolledGroups = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groupCourses)
      .innerJoin(groups, eq(groups.id, groupCourses.groupId))
      .where(eq(groupCourses.courseId, courseId));

    return enrolledGroups;
  }
}
