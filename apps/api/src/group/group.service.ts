import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { COURSE_ENROLLMENT } from "@repo/shared";
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
import { isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { CourseService } from "src/courses/course.service";
import {
  CreateGroupEvent,
  DeleteGroupEvent,
  EnrollUserToGroupEvent,
  UpdateGroupEvent,
} from "src/events";
import { GroupSortFields } from "src/group/group.schema";
import { groups, groupUsers, users, groupCourses, studentCourses } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { SQL } from "drizzle-orm";
import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
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
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(forwardRef(() => CourseService)) private readonly courseService: CourseService,
    private readonly eventBus: EventBus,
  ) {}

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

  public async createGroup(createGroupBody: UpsertGroupBody, createdById?: UUIDType) {
    const [createdGroup] = await this.db.insert(groups).values(createGroupBody).returning();

    if (!createdGroup) throw new ConflictException("Unable to create group");

    if (createdById) {
      this.eventBus.publish(
        new CreateGroupEvent({
          groupId: createdGroup.id,
          createdById,
          group: this.buildGroupSnapshot(createdGroup),
        }),
      );
    }

    return createdGroup;
  }

  public async updateGroup(
    groupId: UUIDType,
    updateGroupBody: UpsertGroupBody,
    updatedById?: UUIDType,
  ) {
    const [existingGroup] = await this.db.select().from(groups).where(eq(groups.id, groupId));

    if (!existingGroup) {
      throw new NotFoundException("Group not found");
    }

    const previousSnapshot = this.buildGroupSnapshot(existingGroup);

    const [updatedGroup] = await this.db
      .update(groups)
      .set(updateGroupBody)
      .where(eq(groups.id, groupId))
      .returning();

    const updatedSnapshot = this.buildGroupSnapshot(updatedGroup);

    if (updatedById && !isEqual(previousSnapshot, updatedSnapshot)) {
      this.eventBus.publish(
        new UpdateGroupEvent({
          groupId,
          updatedById,
          previousGroupData: previousSnapshot,
          updatedGroupData: updatedSnapshot,
        }),
      );
    }

    return updatedGroup;
  }

  public async deleteGroup(groupId: UUIDType, deletedById?: UUIDType) {
    const [deletedGroup] = await this.db.delete(groups).where(eq(groups.id, groupId)).returning();

    if (!deletedGroup) {
      throw new NotFoundException("Group not found");
    }

    if (deletedById) {
      this.eventBus.publish(
        new DeleteGroupEvent({
          groupId: deletedGroup.id,
          deletedById,
          groupName: deletedGroup.name,
        }),
      );
    }
  }

  public async bulkDeleteGroups(groupIds: UUIDType[]) {
    if (groupIds.length === 0) {
      throw new BadRequestException("Groups not found");
    }

    await this.db.delete(groups).where(inArray(groups.id, groupIds)).returning();
  }

  async setUserGroups(
    groupIds: UUIDType[],
    userId: UUIDType,
    options: { actorId?: UUIDType; db?: DatabasePg } = {},
  ) {
    const actorId = options.actorId ?? userId;
    const db = options.db ?? this.db;

    await db.transaction(async (trx) => {
      const [user] = await trx
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));

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
        const groupsToAssign = existingGroups.map((group) => ({ userId, groupId: group.id }));

        await trx.insert(groupUsers).values(groupsToAssign);

        if (user.role === USER_ROLES.STUDENT) {
          await Promise.all(
            groupsToAssign.map(({ groupId }) =>
              this.enrollUserToCoursesInGroup(groupId, userId, trx),
            ),
          );

          if (actorId) {
            groupsToAssign.forEach(({ groupId }) =>
              this.eventBus.publish(
                new EnrollUserToGroupEvent({
                  groupId,
                  userId,
                  enrolledById: actorId,
                }),
              ),
            );
          }
        }
      }
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

  async enrollUserToGroupCourses(
    userId: UUIDType,
    groupId: UUIDType,
    existingCourseIds: UUIDType[],
    trx: DatabasePg,
  ) {
    const valuesToInsert = existingCourseIds.map((courseId) => ({
      studentId: userId,
      courseId,
      enrolledByGroupId: groupId,
      status: COURSE_ENROLLMENT.ENROLLED,
    }));

    if (valuesToInsert.length === 0) return;

    const insertedStudentCourses = await trx
      .insert(studentCourses)
      .values(valuesToInsert)
      .onConflictDoUpdate({
        target: [studentCourses.courseId, studentCourses.studentId],
        set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
      })
      .returning({
        courseId: studentCourses.courseId,
      });

    await Promise.all(
      insertedStudentCourses.map(async ({ courseId }) =>
        this.courseService.createCourseDependencies(courseId, userId, null, trx),
      ),
    );
  }

  async enrollUserToCoursesInGroup(groupId: UUIDType, userId: UUIDType, trx: DatabasePg) {
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
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          inArray(
            studentCourses.courseId,
            groupCoursesList.map((gc) => gc.courseId),
          ),
        ),
      );

    const existingCourseIds = existingEnrollments.map(({ courseId }) => courseId);

    const idsToInsert = groupCoursesList
      .filter(({ courseId }) => !existingCourseIds.includes(courseId))
      .map(({ courseId }) => courseId);

    if (idsToInsert) await this.enrollUserToGroupCourses(userId, groupId, idsToInsert, trx);
  }

  private buildGroupSnapshot(group: {
    id: UUIDType;
    name?: string | null;
    characteristic?: string | null;
  }): GroupActivityLogSnapshot {
    return {
      id: group.id,
      name: group.name,
      characteristic: group.characteristic,
    };
  }
}
