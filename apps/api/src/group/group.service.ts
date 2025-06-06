import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, countDistinct, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { GroupSortFields } from "src/group/group.schema";
import { groups, groupUsers, users } from "src/storage/schema";
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
          description: groups.description,
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
    const [dbOutput] = await this.db
      .select({
        groupId: groups.id,
        userId: users.id,
        userRole: users.role,
        associatedRow: groupUsers,
      })
      .from(groupUsers)
      .leftJoin(users, and(eq(users.id, userId)))
      .leftJoin(groups, and(eq(groups.id, groupId)))
      .where(and(eq(groupUsers.groupId, groupId), eq(groupUsers.userId, userId)));

    if (!dbOutput.groupId) throw new NotFoundException("Group not found");
    if (!dbOutput.userId) throw new NotFoundException("User not found");

    if (dbOutput.userRole !== USER_ROLES.STUDENT)
      throw new ConflictException("User is not a student");

    if (dbOutput.associatedRow) throw new ConflictException("User already assigned to the group");

    const [assigned] = await this.db.insert(groupUsers).values({ userId, groupId }).returning();

    if (!assigned) throw new ConflictException("Unable to assign user to the group");

    return;
  }

  async unassignUserFromGroup(groupId: UUIDType, userId: UUIDType) {
    const [assigned] = await this.db
      .select()
      .from(groupUsers)
      .where(and(eq(groupUsers.groupId, groupId), eq(groupUsers.userId, userId)));

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
          ilike(groups.description, `%${filters.keyword.toLowerCase()}%`),
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
}
