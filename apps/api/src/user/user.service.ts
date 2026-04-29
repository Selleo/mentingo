import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  OnboardingPages,
  PERMISSIONS,
  SESSION_REVOCATION_SOCKET,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  SYSTEM_RULE_SET_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
  type SupportedLanguages,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import * as bcrypt from "bcryptjs";
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  not,
  or,
  sql,
} from "drizzle-orm";
import { isEqual } from "lodash";
import { nanoid } from "nanoid";

import { CreatePasswordService } from "src/auth/create-password.service";
import { hashToken } from "src/auth/utils/hash-auth-token";
import { DatabasePg } from "src/common";
import { getGroupFilterConditions } from "src/common/helpers/getGroupFilterConditions";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import hashPassword from "src/common/helpers/hashPassword";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  userHasPermissionCondition as buildUserHasPermissionCondition,
  userLacksAnyPermissionsCondition as buildUserLacksAnyPermissionsCondition,
} from "src/common/permissions/permission-sql.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CreateUserEvent, DeleteUserEvent, UpdateUserEvent } from "src/events";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { UserPasswordReminderEvent } from "src/events/user/user-password-reminder.event";
import { FileService } from "src/file/file.service";
import { GroupService } from "src/group/group.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SessionRevocationService } from "src/redis";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { importUserSchema } from "src/user/schemas/createUser.schema";
import { WsGateway } from "src/websocket/websocket.gateway";

import {
  createTokens,
  credentials,
  groups,
  groupUsers,
  permissionRoles,
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionRuleSets,
  permissionUserRoles,
  userDetails,
  users,
  settings,
  userOnboarding,
  userStatistics,
  studentCourses,
  coursesSummaryStats,
} from "../storage/schema";

import {
  type UsersFilterSchema,
  type UserSortField,
  type UsersQuery,
  UserSortFields,
} from "./schemas/userQuery";
import { USER_LONG_INACTIVITY_DAYS, USER_SHORT_INACTIVITY_DAYS } from "./user.constants";

import type {
  UpdateUserProfileBody,
  UpsertUserDetailsBody,
  BulkAssignUserGroups,
  UpdateUserBody,
  BulkUpdateUsersRolesBody,
} from "./schemas/updateUser.schema";
import type { UserDetailsResponse, UserDetailsWithAvatarKey } from "./schemas/user.schema";
import type { UserActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ChangePasswordBody } from "src/user/schemas/changePassword.schema";
import type { CreateUserBody, ImportUserResponse } from "src/user/schemas/createUser.schema";
import type { CreateUserOptions, CreateUserTransactionResult } from "src/user/user.types";

@Injectable()
export class UserService {
  private readonly SYSTEM_ROLE_DISPLAY_NAME: Record<SystemRoleSlug, string> = {
    [SYSTEM_ROLE_SLUGS.ADMIN]: "Admin",
    [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: "Content Creator",
    [SYSTEM_ROLE_SLUGS.STUDENT]: "Student",
  };
  private readonly SYSTEM_ROLE_PRIORITY: Record<string, number> = {
    [SYSTEM_ROLE_SLUGS.ADMIN]: 0,
    [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR]: 1,
    [SYSTEM_ROLE_SLUGS.STUDENT]: 2,
  };

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly outboxPublisher: OutboxPublisher,
    private fileService: FileService,
    private s3Service: S3Service,
    private createPasswordService: CreatePasswordService,
    private settingsService: SettingsService,
    private readonly groupService: GroupService,
    private statisticsService: StatisticsService,
    private readonly sessionRevocationService: SessionRevocationService,
    private readonly wsGateway: WsGateway,
  ) {}

  public async getUsers(query: UsersQuery = {}) {
    const {
      sort = UserSortFields.firstName,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      filters = {},
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);
    const conditions = this.getFiltersConditions(filters);
    conditions.push(isNull(users.deletedAt));

    const usersData = await this.db
      .select({
        ...getTableColumns(users),
        roleSlugs: sql<
          string[]
        >`COALESCE(json_agg(DISTINCT ${permissionRoles.slug}) FILTER (WHERE ${permissionRoles.slug} IS NOT NULL), '[]')`.as(
          "roleSlugs",
        ),
        groups: sql<
          Array<{ id: string; name: string }>
        >`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${groups.id}, 'name', ${groups.name})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as(
          "groups",
        ),
      })
      .from(users)
      .leftJoin(
        permissionUserRoles,
        and(
          eq(users.id, permissionUserRoles.userId),
          eq(users.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .leftJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions))
      .groupBy(users.id)
      .orderBy(sortOrder(this.getColumnToSortBy(sortedField as UserSortField)))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const usersWithProfilePictures = await Promise.all(
      usersData.map(async (user) => {
        const { avatarReference, ...userWithoutAvatar } = user;
        const usersProfilePictureUrl = await this.getUsersProfilePictureUrl(avatarReference);

        return {
          ...userWithoutAvatar,
          roleSlugs: this.sortRoleSlugs(userWithoutAvatar.roleSlugs),
          profilePictureUrl: usersProfilePictureUrl,
        };
      }),
    );

    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(users)
      .where(and(...conditions));

    return {
      data: usersWithProfilePictures,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  public async getRoles(tenantId: UUIDType) {
    return this.db
      .select({
        ...getTableColumns(permissionRoles),
      })
      .from(permissionRoles)
      .where(eq(permissionRoles.tenantId, tenantId))
      .orderBy(
        sql<number>`
          CASE
            WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.ADMIN} THEN 0
            WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.CONTENT_CREATOR} THEN 1
            WHEN ${permissionRoles.slug} = ${SYSTEM_ROLE_SLUGS.STUDENT} THEN 2
            ELSE 999
          END
        `,
        asc(permissionRoles.name),
      );
  }

  public async getUserById(id: UUIDType, db?: DatabasePg) {
    const dbInstance = db ?? this.db;

    const [user] = await dbInstance
      .select({
        ...getTableColumns(users),
        groups: sql<
          Array<{ id: string; name: string }>
        >`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${groups.id}, 'name', ${groups.name})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as(
          "groups",
        ),
      })
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .groupBy(users.id);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { avatarReference, ...userWithoutAvatar } = user;
    const usersProfilePictureUrl = await this.getUsersProfilePictureUrl(avatarReference);
    const { roleSlugs } = await this.getUserAccess(user.id, dbInstance);

    return {
      ...userWithoutAvatar,
      profilePictureUrl: usersProfilePictureUrl,
      roleSlugs,
    };
  }

  public async getGamificationSummary(userId: UUIDType, db?: DatabasePg) {
    const dbInstance = db ?? this.db;

    const [summary] = await dbInstance
      .select({
        totalPoints: userStatistics.totalPoints,
        lastPointAt: userStatistics.lastPointAt,
      })
      .from(userStatistics)
      .where(eq(userStatistics.userId, userId));

    return {
      totalPoints: summary?.totalPoints ?? 0,
      lastPointAt: summary?.lastPointAt ?? null,
    };
  }

  public async getUserByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));

    return user;
  }

  public async getUserDetails(
    userId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<UserDetailsResponse> {
    const { userId: currentUserId } = currentUser;

    const [userBio]: UserDetailsWithAvatarKey[] = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        avatarReference: users.avatarReference,
        id: users.id,
        description: userDetails.description,
        contactEmail: userDetails.contactEmail,
        contactPhone: userDetails.contactPhoneNumber,
        jobTitle: userDetails.jobTitle,
      })
      .from(users)
      .leftJoin(userDetails, eq(userDetails.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    if (!userBio) throw new NotFoundException("common.toast.notFound");

    const canViewSelf = userId === currentUserId;
    const canManageUsers = hasPermission(currentUser.permissions, PERMISSIONS.USER_MANAGE);
    const { roleSlugs: targetRoleSlugs } = await this.getUserAccess(userId);
    const targetIsAdmin = targetRoleSlugs.includes(SYSTEM_ROLE_SLUGS.ADMIN);

    const canView = canViewSelf || canManageUsers || targetIsAdmin;

    if (!canView) throw new ForbiddenException("common.toast.noAccess");

    const { avatarReference, ...user } = userBio;

    const profilePictureUrl = avatarReference
      ? await this.s3Service.getSignedUrl(avatarReference)
      : null;

    return {
      ...user,
      profilePictureUrl,
    };
  }

  public async updateUser(id: UUIDType, data: UpdateUserBody, actor?: CurrentUserType) {
    const [existingUser] = await this.db
      .select()
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    if (!existingUser?.users) {
      throw new NotFoundException("User not found");
    }

    const shouldRevokeSession =
      data.roleSlugs && (await this.haveRoleAssignmentsChanged(id, data.roleSlugs));

    const updatedUser = await this.db.transaction(async (trx) => {
      const previousSnapshot = actor ? await this.buildUserActivitySnapshot(id, trx) : null;

      const { groups, roleSlugs, ...userData } = data;

      const hasUserDataToUpdate = Object.keys(userData).length > 0;
      const [updatedUser] = hasUserDataToUpdate
        ? await trx.update(users).set(userData).where(eq(users.id, id)).returning()
        : [existingUser.users];

      const { avatarReference, ...userWithoutAvatar } = updatedUser;
      const usersProfilePictureUrl = await this.getUsersProfilePictureUrl(avatarReference);

      if (groups !== undefined) {
        await this.groupService.setUserGroups(groups ?? [], id, {
          actor,
          db: trx,
        });
      }

      if (roleSlugs !== undefined) {
        await this.replaceUserRoleAssignments(id, existingUser.users.tenantId, roleSlugs, trx);
      }

      const updatedSnapshot = actor ? await this.buildUserActivitySnapshot(id, trx) : null;

      const shouldPublishEvent =
        actor && previousSnapshot && updatedSnapshot && !isEqual(previousSnapshot, updatedSnapshot);

      if (shouldPublishEvent) {
        await this.outboxPublisher.publish(
          new UpdateUserEvent({
            userId: id,
            actor,
            previousUserData: previousSnapshot,
            updatedUserData: updatedSnapshot,
          }),
          trx,
        );
      }

      const updatedGroups =
        updatedSnapshot?.groups ?? (await this.getUserGroupsForSnapshot(id, trx));

      return {
        ...userWithoutAvatar,
        profilePictureUrl: usersProfilePictureUrl,
        groups: updatedGroups,
      };
    });

    if (shouldRevokeSession) await this.revokeSessionsAndNotifyUsers([id]);

    return updatedUser;
  }

  async upsertUserDetails(userId: UUIDType, data: UpsertUserDetailsBody) {
    const existingUser = await this.getExistingUser(userId);

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const [updatedUserDetails] = await this.db
      .update(userDetails)
      .set(data)
      .where(eq(userDetails.userId, userId))
      .returning();

    return updatedUserDetails;
  }

  async updateUserProfile(
    id: UUIDType,
    data: UpdateUserProfileBody,
    userAvatar?: Express.Multer.File,
  ) {
    const existingUser = await this.getExistingUser(id);

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    if (!data && !userAvatar) {
      throw new NotFoundException("No data provided for user profile update");
    }

    if (userAvatar) {
      const { fileKey } = await this.fileService.uploadFile(userAvatar, "user-avatars");
      data.userAvatar = fileKey;
    }

    await this.db.transaction(async (tx) => {
      const userUpdates = {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...((data.userAvatar || data.userAvatar === null) && {
          avatarReference: data.userAvatar,
        }),
      };

      const userDetailsUpdates = {
        ...(data.description && { description: data.description }),
        ...(data.contactEmail && { contactEmail: data.contactEmail }),
        ...(data.contactPhone && { contactPhoneNumber: data.contactPhone }),
        ...(data.jobTitle && { jobTitle: data.jobTitle }),
      };

      if (Object.keys(userUpdates).length > 0) {
        await tx.update(users).set(userUpdates).where(eq(users.id, id));
      }

      if (Object.keys(userDetailsUpdates).length > 0) {
        await tx.update(userDetails).set(userDetailsUpdates).where(eq(userDetails.userId, id));
      }
    });
  }

  async changePassword(id: UUIDType, data: ChangePasswordBody) {
    const existingUser = await this.getExistingUser(id);

    const { oldPassword, newPassword, confirmPassword } = data;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException("changePasswordView.validation.passwordsDontMatch");
    }

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const [userCredentials] = await this.db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, id));

    if (!userCredentials) {
      return await this.createPasswordService.createUserPassword(id, newPassword);
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, userCredentials.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException("Invalid old password");
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await this.db
      .update(credentials)
      .set({ password: hashedNewPassword })
      .where(eq(credentials.userId, id));
  }

  async resetPassword(id: UUIDType, newPassword: string) {
    const existingUser = await this.getExistingUser(id);

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const [userCredentials] = await this.db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, id));

    if (!userCredentials) {
      throw new NotFoundException("User credentials not found");
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await this.db
      .update(credentials)
      .set({ password: hashedNewPassword })
      .where(eq(credentials.userId, id));
  }

  public async deleteUser(actor: CurrentUserType, id: UUIDType) {
    if (id === actor.userId) {
      throw new BadRequestException("You cannot delete your own account");
    }

    const [userToDelete] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, id),
          isNull(users.deletedAt),
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.LEARNING_PROGRESS_UPDATE,
          ),
          buildUserLacksAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
            PERMISSIONS.LEARNING_MODE_USE,
          ]),
        ),
      );

    if (!userToDelete) throw new BadRequestException("You can only delete students");

    const userSnapshot = await this.buildUserActivitySnapshot(id);

    return this.db.transaction(async (trx) => {
      await this.deflateStatisticsForCourseDeletedUser(userToDelete.id, trx);

      const idPart = id.split("-")[0];

      const [deletedUser] = await trx
        .update(users)
        .set({
          deletedAt: sql`NOW()`,
          email: `deleted_${idPart}@user.com`,
          firstName: "deleted user",
          lastName: "deleted user",
        })
        .where(eq(users.id, id))
        .returning();

      if (userSnapshot) {
        await this.outboxPublisher.publish(
          new DeleteUserEvent({
            userId: id,
            actor,
            deletedUserData: userSnapshot,
          }),
          trx,
        );
      }

      return deletedUser;
    });
  }

  public async deleteBulkUsers(actor: CurrentUserType, ids: UUIDType[]) {
    if (ids.includes(actor.userId)) {
      throw new BadRequestException("You cannot delete yourself");
    }

    const usersToDelete = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, ids),
          isNull(users.deletedAt),
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.LEARNING_PROGRESS_UPDATE,
          ),
          buildUserLacksAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
            PERMISSIONS.LEARNING_MODE_USE,
          ]),
        ),
      );

    if (usersToDelete.length !== ids.length)
      throw new BadRequestException("You can only delete students");

    const usersSnapshots = await Promise.all(ids.map((id) => this.buildUserActivitySnapshot(id)));

    return this.db.transaction(async (trx) => {
      await Promise.all(
        ids.map(async (id) => {
          await this.deflateStatisticsForCourseDeletedUser(id, trx);
        }),
      );

      await Promise.all(
        ids.map((id) =>
          trx
            .update(users)
            .set({
              deletedAt: sql`NOW()`,
              email: `deleted_${id.split("-")[0]}@user.com`,
              firstName: "deleted user",
              lastName: "deleted user",
            })
            .where(eq(users.id, id)),
        ),
      );

      await Promise.all(
        usersSnapshots.map((snapshot, index) => {
          const userId = ids[index];
          if (!snapshot) return Promise.resolve();

          return this.outboxPublisher.publish(
            new DeleteUserEvent({
              userId,
              actor,
              deletedUserData: snapshot,
            }),
            trx,
          );
        }),
      );
    });
  }

  public async createUser(
    data: CreateUserBody,
    dbInstance?: DatabasePg,
    creator?: CurrentUserType,
    options?: CreateUserOptions,
  ) {
    const db = dbInstance ?? this.db;

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, data.email)));

    if (existingUser) throw new ConflictException("User already exists");

    const { createdUser, token, newUsersLanguage } = await this.createUserTransaction(
      db,
      data,
      creator,
      options,
    );

    if (options?.registration) return createdUser;

    if (creator) {
      if (!token) throw new InternalServerErrorException("common.toast.somethingWentWrong");

      const snapshot = await this.buildUserActivitySnapshot(createdUser.id);

      await this.outboxPublisher.publish(
        new CreateUserEvent({
          userId: createdUser.id,
          actor: creator,
          createdUserData: snapshot,
        }),
      );

      await this.outboxPublisher.publish(
        new UserInviteEvent({
          creatorId: creator.userId,
          email: createdUser.email,
          token,
          userId: createdUser.id,
          tenantId: createdUser.tenantId,
        }),
      );

      return createdUser;
    }

    if (options?.invite) {
      if (!token) throw new InternalServerErrorException("common.toast.somethingWentWrong");

      await this.outboxPublisher.publish(
        new UserInviteEvent({
          email: createdUser.email,
          token,
          userId: createdUser.id,
          tenantId: createdUser.tenantId,
          invitedByUserName: options.invite.invitedByUserName,
          origin: options.invite.origin,
        }),
      );

      return createdUser;
    }

    if (!token) throw new InternalServerErrorException("common.toast.somethingWentWrong");

    await this.outboxPublisher.publish(
      new UserPasswordReminderEvent({
        email: createdUser.email,
        token,
        userId: createdUser.id,
        tenantId: createdUser.tenantId,
        language: newUsersLanguage,
      }),
    );

    return createdUser;
  }

  private async createUserTransaction(
    db: DatabasePg,
    data: CreateUserBody,
    creator?: CurrentUserType,
    options?: CreateUserOptions,
  ): Promise<CreateUserTransactionResult> {
    return db.transaction(async (trx) => {
      const { roleSlugs, ...userData } = data;
      const [createdUser] = await trx.insert(users).values(userData).returning();

      await this.replaceUserRoleAssignments(createdUser.id, createdUser.tenantId, roleSlugs, trx);

      await trx.insert(userOnboarding).values({ userId: createdUser.id });

      let newUsersLanguage: SupportedLanguages = SUPPORTED_LANGUAGES.EN;

      if (creator) {
        const creatorSettings = await this.settingsService.getUserSettings(
          creator.userId,
          this.dbAdmin,
        );

        newUsersLanguage = Object.values(SUPPORTED_LANGUAGES).includes(
          data.language as SupportedLanguages,
        )
          ? (data.language as SupportedLanguages)
          : (creatorSettings.language as SupportedLanguages);
      }

      if (options?.registration) {
        newUsersLanguage = Object.values(SUPPORTED_LANGUAGES).includes(
          data.language as SupportedLanguages,
        )
          ? (data.language as SupportedLanguages)
          : SUPPORTED_LANGUAGES.EN;
      }

      const settingsOverride =
        creator || options?.registration ? { language: newUsersLanguage } : undefined;

      await this.settingsService.createSettingsIfNotExists(
        createdUser.id,
        roleSlugs,
        settingsOverride,
        trx,
      );

      if (options?.registration) {
        await trx.insert(credentials).values({
          userId: createdUser.id,
          password: options.registration.hashedPassword,
        });

        return { createdUser, newUsersLanguage };
      }

      const token = nanoid(64);
      const hashedCreateToken = hashToken(token);
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await trx.insert(createTokens).values({
        userId: createdUser.id,
        createToken: hashedCreateToken,
        expiryDate,
        reminderCount: 0,
      });

      const rolePermissions = await this.getPermissionsForRoleSlugs(
        roleSlugs,
        createdUser.tenantId,
        trx,
      );
      const canManageContent =
        rolePermissions.includes(PERMISSIONS.COURSE_UPDATE) ||
        rolePermissions.includes(PERMISSIONS.COURSE_UPDATE_OWN);
      const canManageTenant = rolePermissions.includes(PERMISSIONS.TENANT_MANAGE);

      if (canManageContent || canManageTenant) {
        await trx
          .insert(userDetails)
          .values({ userId: createdUser.id, contactEmail: createdUser.email });
      }

      return { createdUser, token, newUsersLanguage };
    });
  }

  public getUsersProfilePictureUrl = async (avatarReference: string | null) => {
    if (!avatarReference) return null;
    return await this.s3Service.getSignedUrl(avatarReference);
  };

  public async getAdminsToNotifyAboutNewUser(emailToExclude: string) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          isNull(users.deletedAt),
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.TENANT_MANAGE,
          ),
          sql`${settings.settings}->>'adminNewUserNotification' = 'true'`,
          not(eq(users.email, emailToExclude)),
        ),
      );
  }

  public async getStudentEmailsByIds(studentIds: UUIDType[]) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.LEARNING_PROGRESS_UPDATE,
          ),
          buildUserLacksAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
          inArray(users.id, studentIds),
          isNull(users.deletedAt),
        ),
      );
  }

  async bulkAssignUsersToGroup(data: BulkAssignUserGroups, actor?: CurrentUserType) {
    await this.db.transaction(async (trx) => {
      await Promise.all(
        data.map((user) =>
          this.groupService.setUserGroups(user.groups, user.userId, {
            db: trx,
            actor,
          }),
        ),
      );
    });
  }

  public async getAdminsWithSettings() {
    const adminsWithSettings = await this.db
      .select({
        user: users,
        settings: settings,
      })
      .from(users)
      .leftJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.TENANT_MANAGE,
          ),
          isNull(users.deletedAt),
        ),
      );

    return adminsWithSettings;
  }

  async importUsers(usersDataFile: Express.Multer.File, creator: CurrentUserType) {
    const importStats: ImportUserResponse = {
      importedUsersAmount: 0,
      skippedUsersAmount: 0,
      importedUsersList: [],
      skippedUsersList: [],
    };

    const usersData = await this.fileService.parseExcelFile<typeof importUserSchema>(
      usersDataFile,
      importUserSchema,
    );

    for (const userData of usersData) {
      const [existingUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));

      if (existingUser) {
        importStats.skippedUsersAmount++;
        importStats.skippedUsersList.push({
          email: userData.email,
          reason: "files.import.userFailReason.alreadyExists",
        });
        continue;
      }

      await this.db.transaction(async (trx) => {
        const { groups: groupNames, ...userInfo } = userData;

        const createdUser = await this.createUser({ ...userInfo }, trx, creator);

        importStats.importedUsersAmount++;
        importStats.importedUsersList.push(userData.email);

        if (!groupNames?.length) return;

        const existingGroups = await trx
          .select()
          .from(groups)
          .where(inArray(groups.name, groupNames));

        if (!existingGroups.length) return;

        await this.groupService.setUserGroups(
          existingGroups.map((group) => group.id),
          createdUser.id,
          {
            db: trx,
            actor: creator,
          },
        );
      });
    }

    return importStats;
  }

  public async bulkArchiveUsers(userIds: UUIDType[]) {
    const usersToArchive = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.archived, false), isNull(users.deletedAt)));

    if (!usersToArchive.length) throw new NotFoundException("No users found to archive");

    const usersToArchiveIds = usersToArchive.map(({ id }) => id);

    const archivedUsers = await this.db
      .update(users)
      .set({ archived: true })
      .where(inArray(users.id, usersToArchiveIds))
      .returning();

    return {
      archivedUsersCount: archivedUsers.length,
      usersAlreadyArchivedCount: userIds.length - usersToArchive.length,
    };
  }

  private async buildUserActivitySnapshot(
    userId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<UserActivityLogSnapshot | null> {
    const [user] = await dbInstance
      .select({
        ...getTableColumns(users),
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    if (!user) return null;

    const userGroups = await this.getUserGroupsForSnapshot(userId, dbInstance);

    return {
      ...user,
      groups: userGroups,
    };
  }

  private async getUserGroupsForSnapshot(
    userId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<Array<{ id: UUIDType; name: string | null }>> {
    const userGroups = await dbInstance
      .select({
        id: groups.id,
        name: groups.name,
      })
      .from(groupUsers)
      .innerJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(eq(groupUsers.userId, userId))
      .orderBy(asc(groups.name));

    return userGroups.map(({ id, name }) => ({ id, name }));
  }

  private getFiltersConditions(filters: UsersFilterSchema) {
    const conditions = [];

    if (filters.keyword) {
      conditions.push(
        or(
          ilike(users.firstName, `%${filters.keyword.toLowerCase()}%`),
          ilike(users.lastName, `%${filters.keyword.toLowerCase()}%`),
          ilike(users.email, `%${filters.keyword.toLowerCase()}%`),
        ),
      );
    }
    if (filters.archived !== undefined) {
      conditions.push(eq(users.archived, filters.archived));
    }

    if (filters.roleSlug) {
      conditions.push(sql`
        EXISTS (
          SELECT 1
          FROM permission_user_roles pur
          INNER JOIN permission_roles pr
            ON pr.id = pur.role_id
           AND pr.tenant_id = pur.tenant_id
          WHERE pur.user_id = ${users.id}
            AND pr.slug = ${filters.roleSlug}
        )
      `);
    }

    if (filters.groups?.length) {
      conditions.push(getGroupFilterConditions(filters.groups));
    }

    return conditions.length ? conditions : [sql`1=1`];
  }

  private getColumnToSortBy(sort: UserSortField) {
    switch (sort) {
      case UserSortFields.firstName:
        return users.firstName;
      case UserSortFields.lastName:
        return users.lastName;
      case UserSortFields.email:
        return users.email;
      case UserSortFields.createdAt:
        return users.createdAt;
      default:
        return users.firstName;
    }
  }

  public async getAdminsToNotifyAboutFinishedCourse(): Promise<
    { email: string; id: string; tenantId: string }[]
  > {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.TENANT_MANAGE,
          ),
          sql`${settings.settings}->>'adminFinishedCourseNotification' = 'true'`,
          isNull(users.deletedAt),
        ),
      );
  }

  public async getAdminsToNotifyAboutOverdueCourse(): Promise<
    { email: string; id: string; tenantId: string }[]
  > {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          buildUserHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.TENANT_MANAGE,
          ),
          sql`${settings.settings}->>'adminOverdueCourseNotification' = 'true'`,
          isNull(users.deletedAt),
        ),
      );
  }

  async checkUsersInactivity() {
    const shortInactivity = await this.statisticsService.getInactiveStudents(
      USER_SHORT_INACTIVITY_DAYS,
    );
    const longInactivity =
      await this.statisticsService.getInactiveStudents(USER_LONG_INACTIVITY_DAYS);

    return { shortInactivity, longInactivity };
  }

  async getAllOnboardingStatus(userId: UUIDType) {
    const [onboardingStatus] = await this.db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    return onboardingStatus;
  }

  async markOnboardingPageAsCompleted(userId: UUIDType, page: OnboardingPages) {
    const [existingOnboarding] = await this.db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (existingOnboarding) {
      const [updatedOnboarding] = await this.db
        .update(userOnboarding)
        .set({ [page]: true })
        .where(eq(userOnboarding.userId, userId))
        .returning();

      return updatedOnboarding;
    }

    const [newUserOnboarding] = await this.db
      .insert(userOnboarding)
      .values({ userId, [page]: true })
      .returning();

    if (!newUserOnboarding) {
      throw new Error("Failed to mark onboarding as completed");
    }

    return newUserOnboarding;
  }

  async resetOnboardingForUser(userId: UUIDType) {
    const onboardingPagesWithValues = Object.values(OnboardingPages).reduce(
      (acc, page) => {
        acc[page] = false;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    const [updatedOnboarding] = await this.db
      .update(userOnboarding)
      .set({
        ...onboardingPagesWithValues,
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();

    return updatedOnboarding;
  }

  async updateUsersRoles(data: BulkUpdateUsersRolesBody, currentUser: CurrentUserType) {
    if (data.userIds.includes(currentUser.userId)) {
      throw new BadRequestException("adminUsersView.toast.cannotUpdateOwnRole");
    }

    if (!data.userIds.length) {
      throw new BadRequestException("adminUsersView.toast.noUserSelected");
    }

    const usersToUpdate = await this.db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(and(inArray(users.id, data.userIds), isNull(users.deletedAt)));

    if (usersToUpdate.length !== data.userIds.length) {
      throw new BadRequestException("adminUsersView.toast.noUserSelected");
    }

    const usersWithChangedRoles = await Promise.all(
      usersToUpdate.map(async (user) => {
        const hasChanged = await this.haveRoleAssignmentsChanged(user.id, data.roleSlugs);
        return hasChanged ? user.id : null;
      }),
    );

    await this.db.transaction(async (trx) => {
      await Promise.all(
        usersToUpdate.map((user) =>
          this.replaceUserRoleAssignments(user.id, user.tenantId, data.roleSlugs, trx),
        ),
      );
    });

    const usersToRevoke = usersWithChangedRoles.filter((userId): userId is UUIDType =>
      Boolean(userId),
    );

    if (usersToRevoke.length) await this.revokeSessionsAndNotifyUsers(usersToRevoke);
  }

  private async revokeSessionsAndNotifyUsers(userIds: UUIDType[]): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        await this.sessionRevocationService.revokeUserSessions(userId);
        this.wsGateway.emitToUser(userId, SESSION_REVOCATION_SOCKET.EVENTS.PERMISSIONS_UPDATED, {
          reason: SESSION_REVOCATION_SOCKET.REASONS.ROLES_CHANGED,
          messageKey: SESSION_REVOCATION_SOCKET.MESSAGE_KEYS.PERMISSIONS_UPDATED,
        });
      }),
    );
  }

  private async haveRoleAssignmentsChanged(userId: UUIDType, nextRoleSlugs: string[]) {
    const { roleSlugs: currentRoleSlugs } = await this.getUserAccess(userId);

    const uniqueCurrentRoleSlugs = new Set(currentRoleSlugs);
    const uniqueNextRoleSlugs = new Set(nextRoleSlugs);

    if (uniqueCurrentRoleSlugs.size !== uniqueNextRoleSlugs.size) return true;

    for (const roleSlug of uniqueCurrentRoleSlugs) {
      if (!uniqueNextRoleSlugs.has(roleSlug)) return true;
    }

    return false;
  }

  private async replaceUserRoleAssignments(
    userId: UUIDType,
    tenantId: UUIDType,
    roleSlugs: string[],
    dbInstance: DatabasePg = this.db,
  ): Promise<void> {
    await this.ensureSystemRolesForTenant(tenantId, dbInstance);

    const uniqueRoleSlugs = Array.from(new Set(roleSlugs));

    if (!uniqueRoleSlugs.length) {
      throw new BadRequestException("adminUsersView.toast.userMustHaveAtLeastOneRole");
    }

    const roles = await dbInstance
      .select({ id: permissionRoles.id, slug: permissionRoles.slug })
      .from(permissionRoles)
      .where(
        and(eq(permissionRoles.tenantId, tenantId), inArray(permissionRoles.slug, uniqueRoleSlugs)),
      );

    if (roles.length !== uniqueRoleSlugs.length) {
      throw new BadRequestException("adminUsersView.toast.invalidRole");
    }

    await dbInstance.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, userId));

    await dbInstance.insert(permissionUserRoles).values(
      roles.map((role) => ({
        userId,
        roleId: role.id,
        tenantId,
      })),
    );
  }

  private async ensureSystemRolesForTenant(
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<void> {
    for (const roleSlug of Object.values(SYSTEM_ROLE_SLUGS)) {
      const ruleSetSlug = SYSTEM_RULE_SET_SLUGS[roleSlug];
      const permissions = SYSTEM_ROLE_PERMISSIONS[roleSlug];

      const [role] = await dbInstance
        .insert(permissionRoles)
        .values({
          tenantId,
          name: this.SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
          slug: roleSlug,
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: [permissionRoles.tenantId, permissionRoles.slug],
          set: {
            name: this.SYSTEM_ROLE_DISPLAY_NAME[roleSlug],
            isSystem: true,
            updatedAt: sql`NOW()`,
          },
        })
        .returning({ id: permissionRoles.id });

      const [ruleSet] = await dbInstance
        .insert(permissionRuleSets)
        .values({
          tenantId,
          name: `${this.SYSTEM_ROLE_DISPLAY_NAME[roleSlug]} Default`,
          slug: ruleSetSlug,
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: [permissionRuleSets.tenantId, permissionRuleSets.slug],
          set: {
            name: `${this.SYSTEM_ROLE_DISPLAY_NAME[roleSlug]} Default`,
            isSystem: true,
            updatedAt: sql`NOW()`,
          },
        })
        .returning({ id: permissionRuleSets.id });

      await dbInstance
        .insert(permissionRoleRuleSets)
        .values({
          tenantId,
          roleId: role.id,
          ruleSetId: ruleSet.id,
        })
        .onConflictDoNothing({
          target: [permissionRoleRuleSets.roleId, permissionRoleRuleSets.ruleSetId],
        });

      await dbInstance
        .delete(permissionRuleSetPermissions)
        .where(
          and(
            eq(permissionRuleSetPermissions.ruleSetId, ruleSet.id),
            eq(permissionRuleSetPermissions.tenantId, tenantId),
          ),
        );

      if (permissions.length) {
        await dbInstance
          .insert(permissionRuleSetPermissions)
          .values(
            permissions.map((permission) => ({
              tenantId,
              ruleSetId: ruleSet.id,
              permission,
            })),
          )
          .onConflictDoNothing({
            target: [
              permissionRuleSetPermissions.ruleSetId,
              permissionRuleSetPermissions.permission,
            ],
          });
      }
    }
  }

  private async getPermissionsForRoleSlugs(
    roleSlugs: string[],
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<PermissionKey[]> {
    const uniqueRoleSlugs = Array.from(new Set(roleSlugs));

    if (!uniqueRoleSlugs.length) {
      return [];
    }

    const rolePermissions = await dbInstance
      .selectDistinct({ permission: permissionRuleSetPermissions.permission })
      .from(permissionRoles)
      .innerJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(
        and(eq(permissionRoles.tenantId, tenantId), inArray(permissionRoles.slug, uniqueRoleSlugs)),
      );

    return rolePermissions.map(({ permission }) => permission);
  }

  private async getUserAccess(userId: UUIDType, dbInstance: DatabasePg = this.db) {
    const roleRows = await dbInstance
      .select({
        roleSlug: permissionRoles.slug,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(eq(permissionUserRoles.userId, userId));

    const permissionRows = await dbInstance
      .select({
        permission: permissionRuleSetPermissions.permission,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(eq(permissionUserRoles.userId, userId));

    const roleSlugs = this.sortRoleSlugs(Array.from(new Set(roleRows.map((row) => row.roleSlug))));
    const permissions = Array.from(
      new Set(permissionRows.map((row) => row.permission as PermissionKey)),
    );

    return { roleSlugs, permissions };
  }

  private sortRoleSlugs(roleSlugs: string[]): string[] {
    return [...roleSlugs].sort((left, right) => {
      const leftPriority = this.SYSTEM_ROLE_PRIORITY[left] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = this.SYSTEM_ROLE_PRIORITY[right] ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      return left.localeCompare(right);
    });
  }

  private async deflateStatisticsForCourseDeletedUser(userId: UUIDType, trx: DatabasePg = this.db) {
    const courseStatistics = await trx
      .select({
        courseId: studentCourses.courseId,
        courseCompleted: sql<boolean>`CASE WHEN ${studentCourses.completedAt} IS NOT NULL THEN TRUE ELSE FALSE END`,
        isPaid: sql<boolean>`CASE WHEN ${studentCourses.paymentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
      })
      .from(studentCourses)
      .where(eq(studentCourses.studentId, userId));

    await Promise.all(
      courseStatistics.map((courseStatistic) =>
        trx
          .update(coursesSummaryStats)
          .set({
            completedCourseStudentCount: sql`CASE WHEN ${courseStatistic.courseCompleted} THEN ${coursesSummaryStats.completedCourseStudentCount} - 1 ELSE ${coursesSummaryStats.completedCourseStudentCount} END`,
            freePurchasedCount: sql`CASE WHEN ${courseStatistic.isPaid} THEN ${coursesSummaryStats.freePurchasedCount} ELSE ${coursesSummaryStats.freePurchasedCount} - 1 END`,
            paidPurchasedCount: sql`CASE WHEN ${courseStatistic.isPaid} THEN ${coursesSummaryStats.paidPurchasedCount} - 1 ELSE ${coursesSummaryStats.paidPurchasedCount} END`,
          })
          .where(eq(coursesSummaryStats.courseId, courseStatistic.courseId)),
      ),
    );
  }

  private async getExistingUser(userId: UUIDType) {
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    return existingUser;
  }
}
