import { Inject, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import {
  eq,
  and,
  getTableColumns,
  count,
  countDistinct,
  isNotNull,
  sql,
  not,
  desc,
  or,
  isNull,
  inArray,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { PermissionsService } from "src/permissions/permissions.service";
import {
  announcements,
  groupAnnouncements,
  groupUsers,
  userAnnouncements,
  users,
} from "src/storage/schema";

import type {
  Announcement,
  CreateAnnouncement,
  AnnouncementFilters,
} from "./types/announcement.types";
import type { AnnouncementPagination } from "./types/announcementPagination.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly permissionsService: PermissionsService,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAllAnnouncements(
    language: SupportedLanguages | undefined,
    pagination: AnnouncementPagination,
  ) {
    return this.db.transaction(async (trx) => {
      const announcementsData = await trx
        .select({
          ...getTableColumns(announcements),
          ...this.getLocalizedAnnouncementFields(language),
        })
        .from(announcements)
        .where(isNull(announcements.deletedAt))
        .orderBy(desc(announcements.createdAt))
        .limit(pagination.perPage)
        .offset((pagination.page - 1) * pagination.perPage);

      const [{ totalItems }] = await trx
        .select({ totalItems: count() })
        .from(announcements)
        .where(isNull(announcements.deletedAt));

      return {
        data: announcementsData,
        pagination: { ...pagination, totalItems },
      };
    });
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    return await this.db
      .select({
        unreadCount: countDistinct(announcements.id),
      })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId))
      .where(
        and(
          eq(userAnnouncements.userId, userId),
          eq(userAnnouncements.isRead, false),
          isNull(announcements.deletedAt),
        ),
      );
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    const { groupId, baseLanguage, translations } = createAnnouncementData;

    const titleTranslations = Object.fromEntries(
      translations.map((translation) => [translation.language, translation.title]),
    );

    const contentTranslations = Object.fromEntries(
      translations.map((translation) => [translation.language, translation.content]),
    );

    const availableLocales = translations.map((translation) => translation.language);

    const [announcement] = await this.db
      .insert(announcements)
      .values({
        title: buildJsonbFieldWithMultipleEntries(titleTranslations),
        content: buildJsonbFieldWithMultipleEntries(contentTranslations),
        baseLanguage,
        availableLocales,
        authorId,
        isEveryone: groupId === null,
      })
      .returning();

    if (groupId) {
      await this.db.insert(groupAnnouncements).values({
        groupId,
        announcementId: announcement.id,
      });

      const usersRelatedToGroup = await this.db
        .select({ userId: groupUsers.userId })
        .from(groupUsers)
        .leftJoin(users, eq(groupUsers.userId, users.id))
        .where(
          and(
            eq(groupUsers.groupId, groupId),
            this.permissionsService.excludeUsersWithPermission(PERMISSIONS.USER_MANAGE),
            isNull(users.deletedAt),
          ),
        );

      await this.createUserAnnouncementRecords(
        usersRelatedToGroup.map((user) => user.userId),
        announcement.id,
      );

      return this.getAnnouncementSnapshot(announcement.id, baseLanguage);
    }

    const allUserIds = await this.db
      .select({ id: users.id })
      .from(users)
      .where(not(eq(users.id, authorId)));
    await this.createUserAnnouncementRecords(
      allUserIds.map((user) => user.id),
      announcement.id,
    );

    return this.getAnnouncementSnapshot(announcement.id, baseLanguage);
  }

  async getAnnouncementById(announcementId: UUIDType) {
    return await this.db
      .select({
        ...getTableColumns(announcements),
        groupId: groupAnnouncements.groupId,
      })
      .from(announcements)
      .leftJoin(groupAnnouncements, eq(groupAnnouncements.announcementId, announcements.id))
      .where(and(eq(announcements.id, announcementId), isNull(announcements.deletedAt)));
  }

  async markAnnouncementAsRead(announcementId: string, userId: UUIDType) {
    return await this.db
      .update(userAnnouncements)
      .set({ isRead: true, readAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(userAnnouncements.announcementId, announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .returning();
  }

  async markAllAnnouncementsAsRead(userId: UUIDType) {
    const activeAnnouncementIds = this.db
      .$with("active_announcement_ids")
      .as(
        this.db
          .select({ id: announcements.id })
          .from(announcements)
          .where(isNull(announcements.deletedAt)),
      );

    const updatedAnnouncements = await this.db
      .with(activeAnnouncementIds)
      .update(userAnnouncements)
      .set({ isRead: true, readAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(userAnnouncements.userId, userId),
          eq(userAnnouncements.isRead, false),
          inArray(
            userAnnouncements.announcementId,
            this.db.select({ id: activeAnnouncementIds.id }).from(activeAnnouncementIds),
          ),
        ),
      )
      .returning({ id: userAnnouncements.id });

    return updatedAnnouncements.length;
  }

  async deleteAnnouncement(announcementId: UUIDType) {
    return await this.db
      .update(announcements)
      .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(announcements.id, announcementId), isNull(announcements.deletedAt)))
      .returning();
  }

  async getAnnouncementsForUser(
    userId: UUIDType,
    filters: AnnouncementFilters | undefined,
    language: SupportedLanguages | undefined,
    pagination: AnnouncementPagination,
  ) {
    const filterConditions = this.getFiltersConditions(filters, language);

    const conditions = and(
      isNotNull(userAnnouncements.userId),
      isNull(announcements.deletedAt),
      ...(filterConditions as any),
    );

    return this.db.transaction(async (trx) => {
      const announcementsData = await trx
        .select({
          ...getTableColumns(announcements),
          ...this.getLocalizedAnnouncementFields(language),
          isRead: userAnnouncements.isRead,
        })
        .from(announcements)
        .innerJoin(
          userAnnouncements,
          and(
            eq(announcements.id, userAnnouncements.announcementId),
            eq(userAnnouncements.userId, userId),
          ),
        )
        .where(conditions)
        .orderBy(desc(announcements.createdAt))
        .limit(pagination.perPage)
        .offset((pagination.page - 1) * pagination.perPage);

      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(announcements.id) })
        .from(announcements)
        .innerJoin(
          userAnnouncements,
          and(
            eq(announcements.id, userAnnouncements.announcementId),
            eq(userAnnouncements.userId, userId),
          ),
        )
        .where(conditions);

      return {
        data: announcementsData,
        pagination: { ...pagination, totalItems },
      };
    });
  }

  private getFiltersConditions(filters?: AnnouncementFilters, language?: SupportedLanguages) {
    const conditions = [] as unknown[];

    if (!filters) return [sql`1=1`];

    if (filters.title)
      conditions.push(
        this.localizationService.getLocalizedFieldSearchCondition(
          announcements.title,
          `%${filters.title.toLowerCase()}%`,
          language,
        ),
      );

    if (filters.content)
      conditions.push(
        this.localizationService.getLocalizedFieldSearchCondition(
          announcements.content,
          `%${filters.content.toLowerCase()}%`,
          language,
        ),
      );

    if (filters.isRead !== undefined) conditions.push(eq(userAnnouncements.isRead, filters.isRead));

    if (filters.search)
      conditions.push(
        or(
          this.localizationService.getLocalizedFieldSearchCondition(
            announcements.title,
            `%${filters.search.toLowerCase()}%`,
            language,
          ),
          this.localizationService.getLocalizedFieldSearchCondition(
            announcements.content,
            `%${filters.search.toLowerCase()}%`,
            language,
          ),
        ),
      );

    return conditions.length ? conditions : [sql`1=1`];
  }

  async createUserAnnouncementRecords(userIds: UUIDType[], announcementId: UUIDType) {
    if (!userIds.length) return;

    const userAnnouncementsToInsert = userIds.map((userId) => ({
      userId,
      announcementId,
      isRead: false,
    }));

    await this.db.insert(userAnnouncements).values(userAnnouncementsToInsert);
  }

  private getLocalizedAnnouncementFields(language?: SupportedLanguages) {
    return {
      title: this.localizationService.getLocalizedSqlField(
        announcements.title,
        language,
        announcements,
      ),
      content: this.localizationService.getLocalizedSqlField(
        announcements.content,
        language,
        announcements,
      ),
    };
  }

  private async getAnnouncementSnapshot(
    announcementId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<Announcement> {
    const [announcement] = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getLocalizedAnnouncementFields(language),
      })
      .from(announcements)
      .where(eq(announcements.id, announcementId));

    return announcement;
  }
}
