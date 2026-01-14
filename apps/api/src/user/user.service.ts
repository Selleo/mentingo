import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { CreatePasswordReminderEmail } from "@repo/email-templates";
import { OnboardingPages, type SupportedLanguages, SUPPORTED_LANGUAGES } from "@repo/shared";
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
import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { getGroupFilterConditions } from "src/common/helpers/getGroupFilterConditions";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import hashPassword from "src/common/helpers/hashPassword";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { CreateUserEvent, DeleteUserEvent, UpdateUserEvent } from "src/events";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { FileService } from "src/file/file.service";
import { GroupService } from "src/group/group.service";
import { S3Service } from "src/s3/s3.service";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsService } from "src/statistics/statistics.service";
import { importUserSchema } from "src/user/schemas/createUser.schema";

import {
  createTokens,
  credentials,
  groups,
  groupUsers,
  userDetails,
  users,
  settings,
  userOnboarding,
  studentCourses,
  coursesSummaryStats,
} from "../storage/schema";

import {
  type UsersFilterSchema,
  type UserSortField,
  type UsersQuery,
  UserSortFields,
} from "./schemas/userQuery";
import { USER_ROLES, type UserRole } from "./schemas/userRoles";
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_ASPECT_RATIO,
  AVATAR_MAX_RESOLUTION,
  AVATAR_MAX_SIZE,
  USER_LONG_INACTIVITY_DAYS,
  USER_SHORT_INACTIVITY_DAYS,
} from "./user.constants";

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
import type { CurrentUser } from "src/common/types/current-user.type";
import type { UserInvite } from "src/events/user/user-invite.event";
import type { CreateUserBody, ImportUserResponse } from "src/user/schemas/createUser.schema";

@Injectable()
export class UserService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly eventBus: EventBus,
    private readonly emailService: EmailService,
    private fileService: FileService,
    private s3Service: S3Service,
    private createPasswordService: CreatePasswordService,
    private settingsService: SettingsService,
    private readonly groupService: GroupService,
    private statisticsService: StatisticsService,
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
        groups: sql<
          Array<{ id: string; name: string }>
        >`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${groups.id}, 'name', ${groups.name})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as(
          "groups",
        ),
      })
      .from(users)
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

  public async getUserById(id: UUIDType) {
    const [user] = await this.db
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

    return {
      ...userWithoutAvatar,
      profilePictureUrl: usersProfilePictureUrl,
    };
  }

  public async getUserByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  public async getUserDetails(
    userId: UUIDType,
    currentUserId: UUIDType,
    userRole: UserRole,
  ): Promise<UserDetailsResponse> {
    const [userBio]: UserDetailsWithAvatarKey[] = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        avatarReference: users.avatarReference,
        role: sql<UserRole>`${users.role}`,
        id: users.id,
        description: userDetails.description,
        contactEmail: userDetails.contactEmail,
        contactPhone: userDetails.contactPhoneNumber,
        jobTitle: userDetails.jobTitle,
      })
      .from(users)
      .leftJoin(userDetails, eq(userDetails.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    const canView =
      userId === currentUserId ||
      USER_ROLES.ADMIN === userRole ||
      USER_ROLES.CONTENT_CREATOR === userRole ||
      USER_ROLES.ADMIN === userBio.role ||
      USER_ROLES.CONTENT_CREATOR === userBio.role;

    if (!canView) {
      throw new ForbiddenException("Cannot access user details");
    }

    const { avatarReference, ...user } = userBio;

    const profilePictureUrl = avatarReference
      ? await this.s3Service.getSignedUrl(avatarReference)
      : null;

    return {
      ...user,
      profilePictureUrl,
    };
  }

  public async updateUser(id: UUIDType, data: UpdateUserBody, actor?: CurrentUser) {
    const [existingUser] = await this.db
      .select()
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    if (!existingUser?.users) {
      throw new NotFoundException("User not found");
    }

    return this.db.transaction(async (trx) => {
      const previousSnapshot = actor ? await this.buildUserActivitySnapshot(id, trx) : null;

      const { groups, ...userData } = data;

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

      const updatedSnapshot = actor ? await this.buildUserActivitySnapshot(id, trx) : null;

      const shouldPublishEvent =
        actor && previousSnapshot && updatedSnapshot && !isEqual(previousSnapshot, updatedSnapshot);

      if (shouldPublishEvent) {
        this.eventBus.publish(
          new UpdateUserEvent({
            userId: id,
            actor,
            previousUserData: previousSnapshot,
            updatedUserData: updatedSnapshot,
          }),
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
      const { fileKey } = await this.fileService.uploadFile(userAvatar, "user-avatars", undefined, {
        allowedTypes: AVATAR_ALLOWED_TYPES,
        maxSize: AVATAR_MAX_SIZE,
        maxResolution: AVATAR_MAX_RESOLUTION,
        aspectRatio: AVATAR_ASPECT_RATIO,
      });
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

  async changePassword(id: UUIDType, oldPassword: string, newPassword: string) {
    const existingUser = await this.getExistingUser(id);

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

  public async deleteUser(actor: CurrentUser, id: UUIDType) {
    if (id === actor.userId) {
      throw new BadRequestException("You cannot delete your own account");
    }

    const [userToDelete] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.role, USER_ROLES.STUDENT)));

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
        this.eventBus.publish(
          new DeleteUserEvent({
            userId: id,
            actor,
            deletedUserData: userSnapshot,
          }),
        );
      }

      return deletedUser;
    });
  }

  public async deleteBulkUsers(actor: CurrentUser, ids: UUIDType[]) {
    if (ids.includes(actor.userId)) {
      throw new BadRequestException("You cannot delete yourself");
    }

    const usersToDelete = await this.db
      .select()
      .from(users)
      .where(
        and(inArray(users.id, ids), isNull(users.deletedAt), eq(users.role, USER_ROLES.STUDENT)),
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

      usersSnapshots.forEach((snapshot, index) => {
        const userId = ids[index];
        if (!snapshot) return;

        this.eventBus.publish(
          new DeleteUserEvent({
            userId,
            actor,
            deletedUserData: snapshot,
          }),
        );
      });
    });
  }

  public async createUser(data: CreateUserBody, dbInstance?: DatabasePg, creator?: CurrentUser) {
    const db = dbInstance ?? this.db;

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, data.email)));

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const { createdUser, token } = await this.db.transaction(async (trx) => {
      const [createdUser] = await trx.insert(users).values(data).returning();
      await trx.insert(userOnboarding).values({ userId: createdUser.id });

      if (creator) {
        const { language: adminsLanguage } = await this.settingsService.getUserSettings(
          creator.userId,
        );

        const finalLanguage = Object.values(SUPPORTED_LANGUAGES).includes(
          data.language as SupportedLanguages,
        )
          ? data.language
          : adminsLanguage;

        await this.settingsService.createSettingsIfNotExists(
          createdUser.id,
          createdUser.role as UserRole,
          { language: finalLanguage },
          trx,
        );
      }

      const token = nanoid(64);

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const [{ createToken }] = await trx
        .insert(createTokens)
        .values({
          userId: createdUser.id,
          createToken: token,
          expiryDate,
          reminderCount: 0,
        })
        .returning();

      await this.settingsService.createSettingsIfNotExists(
        createdUser.id,
        createdUser.role as UserRole,
        undefined,
        trx,
      );

      if (USER_ROLES.CONTENT_CREATOR === createdUser.role || USER_ROLES.ADMIN === createdUser.role)
        await trx
          .insert(userDetails)
          .values({ userId: createdUser.id, contactEmail: createdUser.email });

      return { createdUser, token: createToken };
    });

    if (!createdUser || !token) {
      throw new Error("Failed to create user");
    }

    if (creator) {
      const snapshot = await this.buildUserActivitySnapshot(createdUser.id);

      this.eventBus.publish(
        new CreateUserEvent({
          userId: createdUser.id,
          actor: creator,
          createdUserData: snapshot,
        }),
      );
    }

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(createdUser.id);

    if (!creator) {
      const createPasswordEmail = new CreatePasswordReminderEmail({
        createPasswordLink: `${process.env.CORS_ORIGIN}/auth/create-new-password?createToken=${token}&email=${createdUser.email}`,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo({
        to: createdUser.email,
        subject: getEmailSubject("passwordReminderEmail", defaultEmailSettings.language),
        text: createPasswordEmail.text,
        html: createPasswordEmail.html,
      });

      return createdUser;
    }

    const userInviteDetails: UserInvite = {
      creatorId: creator.userId,
      email: createdUser.email,
      token,
      userId: createdUser.id,
      ...defaultEmailSettings,
    };

    this.eventBus.publish(new UserInviteEvent(userInviteDetails));

    return createdUser;
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
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.role, USER_ROLES.ADMIN),
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
      .where(and(eq(users.role, USER_ROLES.STUDENT), inArray(users.id, studentIds)));
  }

  async bulkAssignUsersToGroup(data: BulkAssignUserGroups, actor?: CurrentUser) {
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
      .where(and(eq(users.role, USER_ROLES.ADMIN), isNull(users.deletedAt)));

    return adminsWithSettings;
  }

  async importUsers(usersDataFile: Express.Multer.File, creator: CurrentUser) {
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
      role: user.role as UserRole,
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
    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
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

  public async getAdminsToNotifyAboutFinishedCourse(): Promise<{ email: string; id: string }[]> {
    return this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          eq(users.role, USER_ROLES.ADMIN),
          sql`${settings.settings}->>'adminFinishedCourseNotification' = 'true'`,
          isNull(users.deletedAt),
        ),
      );
  }

  public async getAdminsToNotifyAboutOverdueCourse(): Promise<{ email: string; id: string }[]> {
    return this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          eq(users.role, USER_ROLES.ADMIN),
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

  async updateUsersRoles(data: BulkUpdateUsersRolesBody, currentUser: CurrentUser) {
    if (data.userIds.includes(currentUser.userId)) {
      throw new BadRequestException("adminUsersView.toast.cannotUpdateOwnRole");
    }

    if (!data.userIds.length) {
      throw new BadRequestException("adminUsersView.toast.noUserSelected");
    }

    await this.db
      .update(users)
      .set({ role: data.role })
      .where(and(inArray(users.id, data.userIds), isNull(users.deletedAt)));
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
