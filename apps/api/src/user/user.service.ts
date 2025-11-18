import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { OnboardingPages } from "@repo/shared";
import * as bcrypt from "bcryptjs";
import { and, count, eq, getTableColumns, ilike, inArray, not, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { CreatePasswordService } from "src/auth/create-password.service";
import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import hashPassword from "src/common/helpers/hashPassword";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { FileService } from "src/file/file.service";
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
  courses,
  userOnboarding,
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
} from "./schemas/updateUser.schema";
import type { UserDetailsResponse, UserDetailsWithAvatarKey } from "./schemas/user.schema";
import type { UUIDType } from "src/common";
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
    private statisticsService: StatisticsService,
    private createPasswordService: CreatePasswordService,
    private settingsService: SettingsService,
  ) {}

  public async getUsers(query: UsersQuery = {}) {
    const {
      sort = UserSortFields.title,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      filters = {},
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);
    const conditions = this.getFiltersConditions(filters);

    const usersData = await this.db
      .select({
        ...getTableColumns(users),
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...conditions))
      .orderBy(sortOrder(this.getColumnToSortBy(sortedField as UserSortField)));

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
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
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
      .select({ ...getTableColumns(users), groupName: groups.name, groupId: groups.id })
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(eq(users.id, id));

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { avatarReference, ...userWithoutAvatar } = user;
    const usersProfilePictureUrl = await this.getUsersProfilePictureUrl(avatarReference);

    return {
      ...userWithoutAvatar,
      profilePictureUrl: usersProfilePictureUrl,
      groupId: user.groupId,
      groupName: user.groupName,
    };
  }

  public async getUserByEmail(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));

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
      .where(eq(users.id, userId));

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

  public async updateUser(id: UUIDType, data: UpdateUserBody) {
    const [existingUser] = await this.db
      .select()
      .from(users)
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(eq(users.id, id));

    if (!existingUser?.users) {
      throw new NotFoundException("User not found");
    }

    return this.db.transaction(async (trx) => {
      const { groupId, ...userData } = data;

      const hasUserDataToUpdate = Object.keys(userData).length > 0;
      const [updatedUser] = hasUserDataToUpdate
        ? await trx.update(users).set(userData).where(eq(users.id, id)).returning()
        : [existingUser.users];

      if (!groupId) {
        return {
          ...updatedUser,
          groupId: existingUser.groups?.id ?? null,
          groupName: existingUser.groups?.name ?? null,
        };
      }

      await trx
        .insert(groupUsers)
        .values({ userId: id, groupId })
        .onConflictDoUpdate({ target: [groupUsers.userId], set: { groupId } });

      const [groupData] = await trx
        .select(getTableColumns(groups))
        .from(groups)
        .innerJoin(groupUsers, eq(groupUsers.groupId, groups.id))
        .where(eq(groupUsers.userId, id));

      const { avatarReference, ...userWithoutAvatar } = updatedUser;
      const usersProfilePictureUrl = await this.getUsersProfilePictureUrl(avatarReference);

      return {
        ...userWithoutAvatar,
        profilePictureUrl: usersProfilePictureUrl,
        groupId: groupData.id,
        groupName: groupData.name,
      };
    });
  }

  async upsertUserDetails(userId: UUIDType, data: UpsertUserDetailsBody) {
    const [existingUser] = await this.db.select().from(users).where(eq(users.id, userId));

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
    const [existingUser] = await this.db.select().from(users).where(eq(users.id, id));

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    if (!data && !userAvatar) {
      throw new NotFoundException("No data provided for user profile update");
    }

    if (userAvatar) {
      const { fileKey } = await this.fileService.uploadFile(userAvatar, "user-avatars", {
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
    const [existingUser] = await this.db.select().from(users).where(eq(users.id, id));

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
    const [existingUser] = await this.db.select().from(users).where(eq(users.id, id));

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

  public async deleteUser(id: UUIDType) {
    await this.validateWhetherUserCanBeDeleted(id);
    const [deletedUser] = await this.db.delete(users).where(eq(users.id, id)).returning();

    if (!deletedUser) {
      throw new NotFoundException("User not found");
    }
  }

  public async deleteBulkUsers(ids: UUIDType[]) {
    await this.validateWhetherUsersCanBeDeleted(ids);
    const deletedUsers = await this.db.delete(users).where(inArray(users.id, ids)).returning();

    if (deletedUsers.length !== ids.length) {
      throw new NotFoundException("Users not found");
    }
  }

  public async createUser(data: CreateUserBody, currentUserId?: UUIDType, dbInstance?: DatabasePg) {
    const db = dbInstance ?? this.db;

    const [existingUser] = await db.select().from(users).where(eq(users.email, data.email));

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    return await this.db.transaction(async (trx) => {
      const [createdUser] = await trx.insert(users).values(data).returning();
      await trx.insert(userOnboarding).values({ userId: createdUser.id });

      const token = nanoid(64);

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      await trx.insert(createTokens).values({
        userId: createdUser.id,
        createToken: token,
        expiryDate,
        reminderCount: 0,
      });

      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties();

      if (currentUserId) {
        const [createdByUser] = await db.select().from(users).where(eq(users.id, currentUserId));

        const userInviteDetails: UserInvite = {
          createdByUserName: createdByUser.firstName + " " + createdByUser.lastName,
          email: createdUser.email,
          token,
          ...defaultEmailSettings,
        };

        this.eventBus.publish(new UserInviteEvent(userInviteDetails));
      }

      if (USER_ROLES.CONTENT_CREATOR === createdUser.role || USER_ROLES.ADMIN === createdUser.role)
        await trx
          .insert(userDetails)
          .values({ userId: createdUser.id, contactEmail: createdUser.email });

      return createdUser;
    });
  }

  public getUsersProfilePictureUrl = async (avatarReference: string | null) => {
    if (!avatarReference) return null;
    return await this.s3Service.getSignedUrl(avatarReference);
  };

  public async getAdminsToNotifyAboutNewUser(emailToExclude: string): Promise<string[]> {
    const adminEmails = await this.db
      .select({
        email: users.email,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          eq(users.role, USER_ROLES.ADMIN),
          sql`${settings.settings}->>'adminNewUserNotification' = 'true'`,
          not(eq(users.email, emailToExclude)),
        ),
      );

    return adminEmails.map((admin) => admin.email);
  }

  public async getStudentEmailsByIds(studentIds: UUIDType[]) {
    const userEmails = await this.db
      .select({
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.role, USER_ROLES.STUDENT), inArray(users.id, studentIds)));

    return userEmails.map((user) => user.email);
  }

  async bulkAssignUsersToGroup(data: BulkAssignUserGroups) {
    await this.db.transaction(async (trx) => {
      await trx
        .insert(groupUsers)
        .values(data.userIds.map((userId) => ({ userId, groupId: data.groupId })))
        .onConflictDoUpdate({
          target: [groupUsers.userId],
          set: { groupId: data.groupId },
        });
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
      .where(and(eq(users.role, USER_ROLES.ADMIN)));

    return adminsWithSettings;
  }

  async importUsers(usersDataFile: Express.Multer.File, currentUserId: UUIDType) {
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
        const { groupName, ...userInfo } = userData;

        const createdUser = await this.createUser({ ...userInfo }, currentUserId, trx);
        await this.settingsService.createSettingsIfNotExists(
          createdUser.id,
          createdUser.role as UserRole,
          undefined,
          trx,
        );

        importStats.importedUsersAmount++;
        importStats.importedUsersList.push(userData.email);

        if (!groupName) return;

        const [group] = await trx.select().from(groups).where(eq(groups.name, groupName));

        if (!group) return;

        await trx
          .insert(groupUsers)
          .values({ userId: createdUser.id, groupId: group.id })
          .onConflictDoUpdate({ target: [groupUsers.userId], set: { groupId: group.id } });
      });
    }

    return importStats;
  }

  public async bulkArchiveUsers(userIds: UUIDType[]) {
    const usersToArchive = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.archived, false)));

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

    if (filters.groupId) {
      conditions.push(eq(groupUsers.groupId, filters.groupId));
    }

    return conditions.length ? conditions : [sql`1=1`];
  }

  private getColumnToSortBy(sort: UserSortField) {
    switch (sort) {
      case UserSortFields.createdAt:
        return users.createdAt;
      case UserSortFields.role:
        return users.role;
      default:
        return users.firstName;
    }
  }

  private async validateWhetherUserCanBeDeleted(userId: UUIDType): Promise<void> {
    const userQuizAttempts = await this.statisticsService.getUserStats(userId);
    const hasCourses = await this.hasCoursesWithAuthor(userId);

    if (userQuizAttempts.quizzes.totalAttempts > 0) {
      throw new ConflictException("adminUserView.toast.userWithAttemptsError");
    }

    if (hasCourses) {
      throw new ConflictException("adminUserView.toast.userWithCreatedCoursesError");
    }
  }

  private async validateWhetherUsersCanBeDeleted(userIds: UUIDType[]): Promise<void> {
    const validationPromises = userIds.map((id) => this.validateWhetherUserCanBeDeleted(id));
    await Promise.all(validationPromises);
  }

  private async hasCoursesWithAuthor(authorId: UUIDType): Promise<boolean> {
    const course = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.authorId, authorId))
      .limit(1)
      .then((results) => results[0]);

    return !!course;
  }

  public async getAdminsToNotifyAboutFinishedCourse(): Promise<string[]> {
    const adminEmails = await this.db
      .select({
        email: users.email,
      })
      .from(users)
      .innerJoin(settings, eq(users.id, settings.userId))
      .where(
        and(
          eq(users.role, USER_ROLES.ADMIN),
          sql`${settings.settings}->>'adminFinishedCourseNotification' = 'true'`,
        ),
      );

    return adminEmails.map((admin) => admin.email);
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
}
