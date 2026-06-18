import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { nanoid } from "nanoid";
import { match } from "ts-pattern";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { DatabasePg } from "src/common";
import { UsersImportInviteEmailsEvent } from "src/events/user/users-import-invite-emails.event";
import { UsersImportEvent } from "src/events/user/users-import.event";
import { FileService } from "src/file/file.service";
import { GroupService } from "src/group/group.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { DB } from "src/storage/db/db.providers";
import { UserImportRepository } from "src/user/repositories/user-import.repository";
import { importUserSchema } from "src/user/schemas/createUser.schema";
import {
  USER_CREATION_FLOW_TYPE,
  type CreateUserContext,
  type CreateUsersCoreBulkCreateTokenRow,
  type CreateUsersCoreBulkCreatedRow,
  type CreateUsersCoreBulkItem,
  type CreateUsersCoreBulkRoleAssignment,
  type CreateUsersCoreBulkResult,
  type CreateUsersCoreBulkUserData,
  type UserImportParsedRow,
  type UserImportRowResolutionContext,
  type UserImportRowResolutionResult,
  type UserImportRowResolvedRoles,
  type UserImportSkippedRowResult,
  type UserImportValidationData,
  type UserImportValidationLookupData,
  type UserImportValidationResult,
} from "src/user/user.types";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ImportUserResponse, SkippedUserImport } from "src/user/schemas/createUser.schema";
import type { CreateUserSettingsResolution } from "src/user/types/create-user-settings-resolution.type";

@Injectable()
export class UserImportService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly fileService: FileService,
    private readonly groupService: GroupService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly settingsService: SettingsService,
    private readonly userImportRepository: UserImportRepository,
  ) {}

  async importUsers(
    usersDataFile: Express.Multer.File,
    creator: CurrentUserType,
  ): Promise<ImportUserResponse> {
    const usersData = await this.fileService.parseExcelFile<typeof importUserSchema>(
      usersDataFile,
      importUserSchema,
    );

    const { createdUsers, skippedUsers } = await this.db.transaction(async (trx) => {
      const { validUsers, skippedUsers } = await this.validateImportRows(usersData, creator, trx);

      if (!validUsers.length) {
        throw new BadRequestException({
          message: "files.import.noValidUsers",
          importedUsersAmount: 0,
          skippedUsersAmount: skippedUsers.length,
          importedUsersList: [],
          skippedUsersList: skippedUsers,
        });
      }

      const createdUsers = await this.createUsersCoreBulk(trx, validUsers, {
        flowType: USER_CREATION_FLOW_TYPE.ADMIN,
        creator,
      });

      await this.publishUsersImportEvents(createdUsers, skippedUsers, creator, trx);

      return { createdUsers, skippedUsers };
    });

    return {
      importedUsersAmount: createdUsers.length,
      skippedUsersAmount: skippedUsers.length,
      importedUsersList: createdUsers.map(({ createdUser }) => createdUser.email),
      skippedUsersList: skippedUsers,
    };
  }

  private async validateImportRows(
    usersData: UserImportParsedRow[],
    creator: CurrentUserType,
    trx: DatabasePg,
  ): Promise<UserImportValidationResult> {
    const rowResolutionContext = await this.prepareImportRowResolutionContext(
      usersData,
      creator,
      trx,
    );

    return this.resolveImportRows(usersData, rowResolutionContext);
  }

  private async prepareImportRowResolutionContext(
    usersData: UserImportParsedRow[],
    creator: CurrentUserType,
    trx: DatabasePg,
  ): Promise<UserImportRowResolutionContext> {
    const importValidationLookup = this.prepareImportValidationLookupData(usersData);

    const [usersWithExistingEmails, resolvedImportData] = await Promise.all([
      this.userImportRepository.findExistingUsersByEmails(importValidationLookup.emails),
      this.userImportRepository.findImportValidationData(importValidationLookup, trx),
    ]);

    const existingEmails = new Set(usersWithExistingEmails.map(({ email }) => email));
    const rolesByNormalizedSlug = this.mapResolvedRolesByNormalizedSlug(resolvedImportData.roles);

    const isTrainerRoleAvailable = await this.resolveImportTrainerRoleAvailability(
      resolvedImportData.roles,
      creator,
    );

    return {
      existingEmails,
      rolesByNormalizedSlug,
      groupsByNormalizedName: this.mapResolvedGroupsByNormalizedName(resolvedImportData.groups),
      isTrainerRoleAvailable,
      acceptedImportEmails: new Set(),
    };
  }

  private async resolveImportTrainerRoleAvailability(
    roles: UserImportValidationData["roles"],
    creator: CurrentUserType,
  ) {
    const hasTrainerRole = roles.some(({ slug }) => slug === SYSTEM_ROLE_SLUGS.TRAINER);

    return hasTrainerRole
      ? this.settingsService.isLiveTrainingEnabledForTenant(creator.tenantId)
      : true;
  }

  private resolveImportRows(
    usersData: UserImportParsedRow[],
    rowResolutionContext: UserImportRowResolutionContext,
  ): UserImportValidationResult {
    const { acceptedImportEmails } = rowResolutionContext;

    const validUsers: CreateUsersCoreBulkItem[] = [];
    const skippedUsers: SkippedUserImport[] = [];

    for (const userData of usersData) {
      const importRowResolution = this.resolveImportRow(userData, rowResolutionContext);

      if ("skippedUser" in importRowResolution) {
        skippedUsers.push(importRowResolution.skippedUser);
        continue;
      }

      acceptedImportEmails.add(userData.email);
      validUsers.push(importRowResolution.validUser);
    }

    return { validUsers, skippedUsers };
  }

  private prepareImportValidationLookupData(
    usersData: UserImportParsedRow[],
  ): UserImportValidationLookupData {
    return {
      emails: [...new Set(usersData.map(({ email }) => email))],
      roleSlugs: [
        ...new Set(usersData.flatMap(({ roleSlugs }) => this.normalizeRoleSlugs(roleSlugs))),
      ],
      groupNames: [
        ...new Set(usersData.flatMap(({ groups }) => this.normalizeImportGroupNames(groups ?? []))),
      ],
    };
  }

  private mapResolvedRolesByNormalizedSlug(roles: UserImportValidationData["roles"]) {
    return new Map(roles.map((role) => [role.slug.toLowerCase(), role]));
  }

  private mapResolvedGroupsByNormalizedName(groups: UserImportValidationData["groups"]) {
    const groupsByNormalizedName: UserImportRowResolutionContext["groupsByNormalizedName"] =
      new Map();

    for (const group of groups) {
      const existingGroups = groupsByNormalizedName.get(group.normalizedName);

      if (existingGroups) {
        existingGroups.push(group);
        continue;
      }

      groupsByNormalizedName.set(group.normalizedName, [group]);
    }

    return groupsByNormalizedName;
  }

  private resolveImportRow(
    userData: UserImportParsedRow,
    context: UserImportRowResolutionContext,
  ): UserImportRowResolutionResult {
    const { existingEmails, isTrainerRoleAvailable, acceptedImportEmails } = context;

    if (existingEmails.has(userData.email)) {
      return this.skipImportRow(userData.email, "files.import.userFailReason.alreadyExists");
    }

    const resolvedRoles = this.resolveImportRowRoles(userData.roleSlugs, context);

    if (!resolvedRoles) {
      return this.skipImportRow(userData.email, "files.import.userFailReason.invalidRole");
    }

    if (resolvedRoles.roleSlugs.includes(SYSTEM_ROLE_SLUGS.TRAINER) && !isTrainerRoleAvailable) {
      return this.skipImportRow(
        userData.email,
        "files.import.userFailReason.trainerRoleUnavailable",
      );
    }

    const groupIds = this.resolveImportRowGroupIds(userData.groups ?? [], context);

    if (!groupIds) {
      return this.skipImportRow(userData.email, "files.import.userFailReason.unknownGroup");
    }

    if (acceptedImportEmails.has(userData.email)) {
      return this.skipImportRow(userData.email, "files.import.userFailReason.duplicateEmail");
    }

    const { groups: _groups, ...userInsertData } = userData;

    return {
      validUser: {
        ...userInsertData,
        roleIds: resolvedRoles.roleIds,
        roleSlugs: resolvedRoles.roleSlugs,
        groupIds,
      },
    };
  }

  private resolveImportRowRoles(
    roleSlugs: string[],
    context: Pick<UserImportRowResolutionContext, "rolesByNormalizedSlug">,
  ): UserImportRowResolvedRoles | null {
    const normalizedRoleSlugs = this.normalizeRoleSlugs(roleSlugs);

    if (!normalizedRoleSlugs.length) return null;

    const resolvedRoles: UserImportRowResolvedRoles = {
      roleIds: [],
      roleSlugs: [],
    };

    for (const roleSlug of normalizedRoleSlugs) {
      const resolvedRole = context.rolesByNormalizedSlug.get(roleSlug);

      if (!resolvedRole) return null;

      resolvedRoles.roleIds.push(resolvedRole.id);
      resolvedRoles.roleSlugs.push(resolvedRole.slug);
    }

    return resolvedRoles;
  }

  private resolveImportRowGroupIds(
    groupNames: string[],
    context: Pick<UserImportRowResolutionContext, "groupsByNormalizedName">,
  ) {
    const normalizedGroupNames = this.normalizeImportGroupNames(groupNames);

    if (!normalizedGroupNames.length) return [];

    const hasUnknownGroup = normalizedGroupNames.some(
      (groupName) => !context.groupsByNormalizedName.has(groupName),
    );

    if (hasUnknownGroup) return null;

    const groupIds = normalizedGroupNames.flatMap((groupName) => {
      const groups = context.groupsByNormalizedName.get(groupName);

      return groups?.map(({ id }) => id) ?? [];
    });

    return [...new Set(groupIds)];
  }

  private skipImportRow(email: string, reason: string): UserImportSkippedRowResult {
    return {
      skippedUser: {
        email,
        reason,
      },
    };
  }

  private normalizeImportGroupNames(groupNames: string[]) {
    return [...new Set(groupNames.map((groupName) => groupName.trim().toLowerCase()))];
  }

  private async publishUsersImportEvents(
    createdUsers: CreateUsersCoreBulkResult[],
    skippedUsers: SkippedUserImport[],
    creator: CurrentUserType,
    trx: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new UsersImportInviteEmailsEvent({
        tenantId: creator.tenantId,
        creatorId: creator.userId,
        recipients: createdUsers.map(({ createdUser, token }) => ({
          email: createdUser.email,
          userId: createdUser.id,
          token,
        })),
      }),
      trx,
    );

    await this.outboxPublisher.publish(
      new UsersImportEvent({
        actor: creator,
        tenantId: creator.tenantId,
        importedUsers: createdUsers.map(({ createdUser }) => ({
          email: createdUser.email,
          userId: createdUser.id,
        })),
        skippedRows: skippedUsers,
        importedUsersCount: createdUsers.length,
        skippedRowsCount: skippedUsers.length,
      }),
      trx,
    );
  }

  private async createUsersCoreBulk(
    trx: DatabasePg,
    userImportRows: CreateUsersCoreBulkItem[],
    context: Exclude<CreateUserContext, { flowType: typeof USER_CREATION_FLOW_TYPE.REGISTRATION }>,
  ): Promise<CreateUsersCoreBulkResult[]> {
    if (!userImportRows.length) return [];

    const createdUserImportRows = await this.createUsersAndMapToImportRows(userImportRows, trx);

    const userRoleAssignments = this.prepareUserRoleAssignments(createdUserImportRows);
    await this.insertUserRoleAssignmentsBulk(userRoleAssignments, trx);

    await this.userImportRepository.insertUserOnboardingRows(
      createdUserImportRows.map(({ createdUser }) => createdUser.id),
      trx,
    );

    const createUserSettings = await this.prepareCreateUserSettingsBulk(
      userImportRows,
      createdUserImportRows,
      context,
      trx,
    );
    await this.settingsService.createSettingsForUsers(createUserSettings.userSettings, trx);

    const createTokenExpiryDate = new Date();
    createTokenExpiryDate.setFullYear(createTokenExpiryDate.getFullYear() + 1);

    const createTokenRows = this.prepareCreateTokenRows(
      createdUserImportRows.map(({ createdUser }) => createdUser.id),
      createTokenExpiryDate,
    );

    await this.userImportRepository.insertCreateTokens(createTokenRows, trx);

    const userDetailsToInsert = await this.prepareUserDetailsToInsert(createdUserImportRows, trx);
    await this.userImportRepository.insertUserDetails(userDetailsToInsert, trx);

    const groupAssignments = this.prepareUserGroupAssignments(createdUserImportRows);

    if (groupAssignments.length) {
      await this.groupService.insertUsersGroupAssignmentsBulk(groupAssignments, trx);
    }

    const tokenByUserId = new Map(createTokenRows.map(({ userId, token }) => [userId, token]));

    return createdUserImportRows.map(({ importRow, createdUser }) => ({
      createdUser,
      token: tokenByUserId.get(createdUser.id) as string,
      newUsersLanguage:
        createUserSettings.settingsByEmail.get(importRow.email)?.newUsersLanguage ??
        SUPPORTED_LANGUAGES.EN,
      groupIds: importRow.groupIds ?? [],
    }));
  }

  private async createUsersAndMapToImportRows(
    userImportRows: CreateUsersCoreBulkItem[],
    trx: DatabasePg,
  ) {
    const userInsertRows = this.prepareUserInsertRows(userImportRows);
    const createdUsers = await this.userImportRepository.insertUsers(userInsertRows, trx);

    if (createdUsers.length !== userImportRows.length) {
      throw new InternalServerErrorException("common.toast.somethingWentWrong");
    }

    const createdUserByEmail = new Map(
      createdUsers.map((createdUser) => [createdUser.email, createdUser]),
    );

    return userImportRows.map((importRow) => {
      const createdUser = createdUserByEmail.get(importRow.email);

      if (!createdUser) {
        throw new InternalServerErrorException("common.toast.somethingWentWrong");
      }

      return { importRow, createdUser };
    });
  }

  private prepareUserInsertRows(
    userImportRows: CreateUsersCoreBulkItem[],
  ): CreateUsersCoreBulkUserData[] {
    return userImportRows.map(
      ({ groupIds: _groupIds, roleIds: _roleIds, roleSlugs: _roleSlugs, ...userInsertRow }) =>
        userInsertRow,
    );
  }

  private prepareCreateTokenRows(
    userIds: UUIDType[],
    expiryDate: Date,
  ): CreateUsersCoreBulkCreateTokenRow[] {
    return userIds.map((userId) => {
      const token = nanoid(64);

      return {
        userId,
        token,
        tokenHash: hashToken(token),
        expiryDate,
        reminderCount: 0,
      };
    });
  }

  private prepareUserRoleAssignments(
    createdUserImportRows: CreateUsersCoreBulkCreatedRow[],
  ): CreateUsersCoreBulkRoleAssignment[] {
    return createdUserImportRows.map(({ importRow, createdUser }) => ({
      userId: createdUser.id,
      roleIds: importRow.roleIds,
    }));
  }

  private prepareUserGroupAssignments(createdUserImportRows: CreateUsersCoreBulkCreatedRow[]) {
    return createdUserImportRows
      .map(({ importRow, createdUser }) => ({
        userId: createdUser.id,
        groupIds: importRow.groupIds ?? [],
      }))
      .filter(({ groupIds }) => groupIds.length);
  }

  private async insertUserRoleAssignmentsBulk(
    roleAssignmentsByUser: CreateUsersCoreBulkRoleAssignment[],
    trx: DatabasePg,
  ): Promise<void> {
    await this.userImportRepository.insertUserRoleAssignments(
      roleAssignmentsByUser.flatMap(({ userId, roleIds }) =>
        roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
      ),
      trx,
    );
  }

  private normalizeRoleSlugs(roleSlugs: string[]) {
    return [...new Set(roleSlugs.map((roleSlug) => roleSlug.toLowerCase()))];
  }

  private async prepareUserDetailsToInsert(
    createdUserImportRows: CreateUsersCoreBulkCreatedRow[],
    trx: DatabasePg,
  ) {
    const detailRequiredRoleSlugs = await this.userImportRepository.findRoleSlugsWithAnyPermission(
      [...new Set(createdUserImportRows.flatMap(({ importRow }) => importRow.roleSlugs))],
      [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN, PERMISSIONS.TENANT_MANAGE],
      trx,
    );

    const detailRequiredRoleSlugSet = new Set(
      detailRequiredRoleSlugs.map(({ roleSlug }) => roleSlug),
    );

    return createdUserImportRows
      .filter(({ importRow }) =>
        importRow.roleSlugs.some((roleSlug) => detailRequiredRoleSlugSet.has(roleSlug)),
      )
      .map(({ createdUser }) => ({
        userId: createdUser.id,
        contactEmail: createdUser.email,
      }));
  }

  private async resolveCreateUsersSettingsBulk(
    userImportRows: CreateUsersCoreBulkItem[],
    context: Exclude<CreateUserContext, { flowType: typeof USER_CREATION_FLOW_TYPE.REGISTRATION }>,
    trx: DatabasePg,
  ): Promise<Map<string, CreateUserSettingsResolution>> {
    const adminCreatorLanguage = await match(context)
      .with({ flowType: USER_CREATION_FLOW_TYPE.ADMIN }, async ({ creator }) => {
        const creatorSettings = await this.settingsService.getUserSettings(creator.userId, trx);

        return creatorSettings.language;
      })
      .otherwise(() => undefined);

    return new Map(
      userImportRows.map((importRow) => {
        const newUsersLanguage =
          importRow.language ?? adminCreatorLanguage ?? SUPPORTED_LANGUAGES.EN;

        const settingsOverride = match(context)
          .with({ flowType: USER_CREATION_FLOW_TYPE.ADMIN }, () => ({
            language: newUsersLanguage,
          }))
          .otherwise(() => undefined);

        return [
          importRow.email,
          {
            newUsersLanguage,
            settingsOverride,
          },
        ];
      }),
    );
  }

  private async prepareCreateUserSettingsBulk(
    userImportRows: CreateUsersCoreBulkItem[],
    createdUserImportRows: CreateUsersCoreBulkCreatedRow[],
    context: Exclude<CreateUserContext, { flowType: typeof USER_CREATION_FLOW_TYPE.REGISTRATION }>,
    trx: DatabasePg,
  ) {
    const settingsByEmail = await this.resolveCreateUsersSettingsBulk(userImportRows, context, trx);

    return {
      settingsByEmail,
      userSettings: createdUserImportRows.map(({ importRow, createdUser }) => ({
        userId: createdUser.id,
        roleSlugs: importRow.roleSlugs,
        customSettings: settingsByEmail.get(importRow.email)?.settingsOverride,
      })),
    };
  }
}
