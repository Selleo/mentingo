import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { and, countDistinct, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import { isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import {
  buildJsonbField,
  deleteJsonbField,
  setJsonbField,
  type JsonbFieldUpdate,
} from "src/common/helpers/sqlHelpers";
import { addPagination, DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CourseService } from "src/courses/course.service";
import {
  CreateGroupEvent,
  DeleteGroupEvent,
  EnrollUserToGroupEvent,
  UpdateGroupEvent,
} from "src/events";
import { GroupSortFields } from "src/group/group.schema";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { PermissionsService } from "src/permissions/permissions.service";
import { groupCourses, groups, groupUsers, studentCourses, users } from "src/storage/schema";
import { hasDataToUpdate } from "src/utils/hasDataToUpdate";

import type { SQL } from "drizzle-orm";
import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { PaginatedResponse, Pagination, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GroupSortField, GroupKeywordFilterBody } from "src/group/group.schema";
import type {
  AllGroupsResponse,
  CreateGroupBody,
  GroupsQuery,
  GroupResponse,
  GroupBaseLanguageUpdateBody,
  UpdateGroupBody,
} from "src/group/group.types";
import type { UserResponse } from "src/user/schemas/user.schema";

@Injectable()
export class GroupService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(forwardRef(() => CourseService)) private readonly courseService: CourseService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly permissionsService: PermissionsService,
    private readonly localizationService: LocalizationService,
  ) {}

  public async getAllGroups(
    query: GroupsQuery = {},
  ): Promise<PaginatedResponse<AllGroupsResponse>> {
    const {
      filters = {},
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      sort = GroupSortFields.createdAt,
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);
    const conditions = this.getFiltersConditions(filters, language);

    return this.db.transaction(async (trx) => {
      const queryDB = trx
        .select({
          ...getTableColumns(groups),
          name: this.getLocalizedGroupName(language),
          characteristic: this.getLocalizedGroupCharacteristic(language),
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
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as GroupSortField, language)));

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

  public async getGroupById(
    groupId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<GroupResponse> {
    const [group] = await this.db
      .select({
        ...getTableColumns(groups),
        name: this.getLocalizedGroupName(language),
        characteristic: this.getLocalizedGroupCharacteristic(language),
      })
      .from(groups)
      .where(and(eq(groups.id, groupId)));

    if (!group) {
      throw new NotFoundException("adminGroupsView.updateGroup.groupNotFound");
    }

    return group;
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
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db.transaction(async (trx) => {
      const conditions = [
        eq(groupUsers.userId, userId),
        ...this.getFiltersConditions(filters, language),
      ];

      const queryDB = trx
        .select({
          ...getTableColumns(groups),
          name: this.getLocalizedGroupName(language),
          characteristic: this.getLocalizedGroupCharacteristic(language),
        })
        .from(groupUsers)
        .innerJoin(groups, eq(groups.id, groupUsers.groupId))
        .where(and(...conditions))
        .orderBy(sortOrder(this.getColumnToSortBy(sortedField as GroupSortField, language)));

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

  public async createGroup(createGroupBody: CreateGroupBody, currentUser?: CurrentUserType) {
    const { language, name, characteristic } = createGroupBody;

    const [createdGroup] = await this.db
      .insert(groups)
      .values({
        name: buildJsonbField(language, name),
        characteristic: buildJsonbField(language, characteristic, true),
        baseLanguage: language,
        availableLocales: [language],
      })
      .returning();

    if (!createdGroup) throw new ConflictException("Unable to create group");

    if (currentUser) {
      await this.outboxPublisher.publish(
        new CreateGroupEvent({
          groupId: createdGroup.id,
          actor: currentUser,
          group: await this.buildGroupSnapshot(createdGroup.id, language),
        }),
      );
    }

    return this.getGroupById(createdGroup.id, language);
  }

  public async updateGroup(
    groupId: UUIDType,
    updateGroupBody: UpdateGroupBody,
    currentUser?: CurrentUserType,
  ) {
    const existingGroup = await this.getGroupById(groupId);

    const language = updateGroupBody.language ?? existingGroup.baseLanguage;

    if (!existingGroup.availableLocales.includes(language)) {
      throw new BadRequestException("adminGroupsView.toast.languageNotSupported");
    }

    const previousSnapshot = await this.buildGroupSnapshot(groupId, language);

    const updateData: {
      name?: JsonbFieldUpdate;
      characteristic?: JsonbFieldUpdate;
    } = {};

    if (updateGroupBody.name !== undefined) {
      updateData.name = setJsonbField(groups.name, language, updateGroupBody.name);
    }

    if (updateGroupBody.characteristic !== undefined) {
      updateData.characteristic = setJsonbField(
        groups.characteristic,
        language,
        updateGroupBody.characteristic,
        true,
        true,
      );
    }

    if (!hasDataToUpdate(updateData)) {
      return this.getGroupById(groupId, language);
    }

    await this.db.update(groups).set(updateData).where(eq(groups.id, groupId)).returning();

    await this.publishUpdateEvent(groupId, currentUser, previousSnapshot, language);

    return this.getGroupById(groupId, language);
  }

  public async createLanguage(
    groupId: UUIDType,
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
  ) {
    const existingGroup = await this.getGroupById(groupId, language);

    if (existingGroup.availableLocales.includes(language)) {
      throw new BadRequestException("adminGroupsView.toast.languageAlreadyExists");
    }

    const previousSnapshot = await this.buildGroupSnapshot(groupId, language);

    await this.db
      .update(groups)
      .set({ availableLocales: [...existingGroup.availableLocales, language] })
      .where(eq(groups.id, groupId))
      .returning();

    await this.publishUpdateEvent(groupId, currentUser, previousSnapshot, language);

    return this.getGroupById(groupId, language);
  }

  public async deleteLanguage(
    groupId: UUIDType,
    language: SupportedLanguages,
    currentUser?: CurrentUserType,
  ) {
    const existingGroup = await this.getGroupById(groupId, language);

    if (
      !existingGroup.availableLocales.includes(language) ||
      existingGroup.baseLanguage === language
    ) {
      throw new BadRequestException("adminGroupsView.toast.invalidLanguageToDelete");
    }

    const previousSnapshot = await this.buildGroupSnapshot(groupId, language);

    await this.db
      .update(groups)
      .set({
        name: deleteJsonbField(groups.name, language),
        characteristic: deleteJsonbField(groups.characteristic, language),
        availableLocales: sql`ARRAY_REMOVE(${groups.availableLocales}, ${language})`,
      })
      .where(eq(groups.id, groupId))
      .returning();

    await this.publishUpdateEvent(groupId, currentUser, previousSnapshot, language);

    return this.getGroupById(groupId, existingGroup.baseLanguage);
  }

  public async updateBaseLanguage(
    groupId: UUIDType,
    { baseLanguage }: GroupBaseLanguageUpdateBody,
    currentUser?: CurrentUserType,
  ) {
    const existingGroup = await this.getGroupById(groupId, baseLanguage);

    if (!existingGroup.availableLocales.includes(baseLanguage)) {
      throw new BadRequestException("adminGroupsView.toast.languageNotSupported");
    }

    if (!existingGroup.name) {
      throw new BadRequestException("adminGroupsView.toast.baseLanguageNameRequired");
    }

    const previousSnapshot = await this.buildGroupSnapshot(groupId, existingGroup.baseLanguage);

    await this.db.update(groups).set({ baseLanguage }).where(eq(groups.id, groupId)).returning();

    await this.publishUpdateEvent(groupId, currentUser, previousSnapshot, baseLanguage);

    return this.getGroupById(groupId, baseLanguage);
  }

  public async deleteGroup(groupId: UUIDType, currentUser?: CurrentUserType) {
    const existingGroup = currentUser ? await this.getGroupById(groupId) : null;

    const [deletedGroup] = await this.db.delete(groups).where(eq(groups.id, groupId)).returning();

    if (!deletedGroup) {
      throw new NotFoundException("adminGroupsView.updateGroup.groupNotFound");
    }

    if (currentUser) {
      await this.outboxPublisher.publish(
        new DeleteGroupEvent({
          groupId: deletedGroup.id,
          actor: currentUser,
          groupName: existingGroup?.name,
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
    options: { actor?: CurrentUserType; db?: DatabasePg } = {},
  ) {
    const actor = options.actor;
    const db = options.db ?? this.db;
    let assignedGroupIds: UUIDType[] = [];

    await db.transaction(async (trx) => {
      const [user] = await trx
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const { permissions: userPermissions } = await this.permissionsService.getUserAccess(
        userId,
        trx,
      );

      const canManageUsers = hasPermission(userPermissions, PERMISSIONS.USER_MANAGE);

      const currentUserGroups = await trx
        .select({ groupId: groupUsers.groupId })
        .from(groupUsers)
        .where(eq(groupUsers.userId, userId));

      const currentGroupIds = currentUserGroups.map(({ groupId }) => groupId);
      const removedGroupIds = currentGroupIds.filter((groupId) => !groupIds.includes(groupId));

      await trx.delete(groupUsers).where(eq(groupUsers.userId, userId));

      if (removedGroupIds.length && !canManageUsers) {
        await trx
          .update(studentCourses)
          .set({
            status: COURSE_ENROLLMENT.NOT_ENROLLED,
            enrolledAt: null,
            enrolledByGroupId: null,
          })
          .where(
            and(
              eq(studentCourses.studentId, userId),
              inArray(studentCourses.enrolledByGroupId, removedGroupIds),
            ),
          );
      }

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
        assignedGroupIds = groupsToAssign.map(({ groupId }) => groupId);

        if (!canManageUsers) {
          await Promise.all(
            groupsToAssign.map(({ groupId }) =>
              this.enrollUserToCoursesInGroup(groupId, userId, trx),
            ),
          );
        }
      }
    });

    if (actor && assignedGroupIds.length) {
      await Promise.all(
        assignedGroupIds.map((groupId) =>
          this.outboxPublisher.publish(
            new EnrollUserToGroupEvent({
              groupId,
              userId,
              actor,
            }),
          ),
        ),
      );
    }
  }

  private getFiltersConditions(filters: GroupKeywordFilterBody, language?: SupportedLanguages) {
    const conditions = [];

    if (filters.keyword) {
      const pattern = `%${filters.keyword.toLowerCase()}%`;

      conditions.push(
        or(
          this.localizationService.getLocalizedFieldSearchCondition(groups.name, pattern, language),
          this.localizationService.getLocalizedFieldSearchCondition(
            groups.characteristic,
            pattern,
            language,
          ),
        ) as SQL,
      );
    }

    return conditions ?? [sql`1=1`];
  }

  private getColumnToSortBy(sort: GroupSortField, language?: SupportedLanguages) {
    switch (sort) {
      case GroupSortFields.name:
        return this.getLocalizedGroupName(language);
      default:
        return groups.createdAt;
    }
  }

  async getGroupsByCourse(courseId: UUIDType, language?: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(groups),
        name: this.getLocalizedGroupName(language),
        characteristic: this.getLocalizedGroupCharacteristic(language),
        dueDate: sql<string | null>`TO_CHAR(${groupCourses.dueDate}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
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
        set: {
          enrolledAt: sql`EXCLUDED.enrolled_at`,
          status: sql`EXCLUDED.status`,
          enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
        },
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
    const groupCourseIds = groupCoursesList.map(({ courseId }) => courseId);

    const existingEnrollments = await trx
      .select({
        courseId: studentCourses.courseId,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, userId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          inArray(studentCourses.courseId, groupCourseIds),
        ),
      );

    const individualEnrollmentCourseIds = existingEnrollments
      .filter(({ enrolledByGroupId }) => !enrolledByGroupId)
      .map(({ courseId }) => courseId);

    if (individualEnrollmentCourseIds.length) {
      await trx
        .update(studentCourses)
        .set({ enrolledByGroupId: groupId })
        .where(
          and(
            eq(studentCourses.studentId, userId),
            eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
            isNull(studentCourses.enrolledByGroupId),
            inArray(studentCourses.courseId, individualEnrollmentCourseIds),
          ),
        );
    }

    const existingCourseIds = existingEnrollments.map(({ courseId }) => courseId);

    const idsToInsert = groupCoursesList
      .filter(({ courseId }) => !existingCourseIds.includes(courseId))
      .map(({ courseId }) => courseId);

    if (idsToInsert) await this.enrollUserToGroupCourses(userId, groupId, idsToInsert, trx);
  }

  private async publishUpdateEvent(
    groupId: UUIDType,
    currentUser: CurrentUserType | undefined,
    previousSnapshot: GroupActivityLogSnapshot,
    language: SupportedLanguages,
  ) {
    if (!currentUser) return;

    const updatedSnapshot = await this.buildGroupSnapshot(groupId, language);

    if (isEqual(previousSnapshot, updatedSnapshot)) return;

    await this.outboxPublisher.publish(
      new UpdateGroupEvent({
        groupId,
        actor: currentUser,
        previousGroupData: previousSnapshot,
        updatedGroupData: updatedSnapshot,
      }),
    );
  }

  private async buildGroupSnapshot(
    groupId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<GroupActivityLogSnapshot> {
    const [group] = await this.db
      .select({
        id: groups.id,
        name: this.getLocalizedGroupName(language),
        characteristic: this.getLocalizedGroupCharacteristic(language),
      })
      .from(groups)
      .where(eq(groups.id, groupId));

    return {
      id: groupId,
      name: group.name,
      characteristic: group.characteristic ?? null,
    };
  }

  private getLocalizedGroupName(language?: SupportedLanguages) {
    return this.localizationService.getLocalizedSqlField(groups.name, language, groups);
  }

  private getLocalizedGroupCharacteristic(language?: SupportedLanguages) {
    return sql<string | null>`
      CASE
        WHEN ${groups.characteristic} IS NULL THEN NULL
        ELSE ${this.localizationService.getLocalizedSqlField(groups.characteristic, language, groups)}
      END
    `;
  }
}
