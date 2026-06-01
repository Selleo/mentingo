import { Inject, Injectable } from "@nestjs/common";
import { ANNOUNCEMENT_STATUSES, PERMISSIONS } from "@repo/shared";
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
  asc,
  or,
  isNull,
  inArray,
  type SQL,
  lte,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { addPagination } from "src/common/pagination";
import { LocalizationService } from "src/localization/localization.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { DEFAULT_STUDENT_SETTINGS } from "src/settings/constants/settings.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  announcements,
  groupAnnouncements,
  groupUsers,
  settings as settingsTable,
  userAnnouncements,
  users,
} from "src/storage/schema";

import type {
  AnnouncementSourceLookup,
  CreateAnnouncementRecordInput,
  TenantWithDueScheduledAnnouncements,
} from "./types/announcement-source.types";
import type { Announcement, AnnouncementFilters } from "./types/announcement.types";
import type { AnnouncementPagination } from "./types/announcementPagination.types";
import type { AnnouncementStatus, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly permissionsService: PermissionsService,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAllAnnouncements(
    language: SupportedLanguages | undefined,
    pagination: AnnouncementPagination,
    status?: AnnouncementStatus,
  ) {
    const conditions = [isNull(announcements.deletedAt)];

    if (status) conditions.push(eq(announcements.status, status));

    return this.db.transaction(async (trx) => {
      const announcementsQuery = trx
        .select({
          ...getTableColumns(announcements),
          ...this.getLocalizedAnnouncementFields(language),
        })
        .from(announcements)
        .where(and(...conditions))
        .orderBy(desc(announcements.createdAt))
        .$dynamic();

      const announcementsData = await addPagination(
        announcementsQuery,
        pagination.page,
        pagination.perPage,
      );

      const [{ totalItems }] = await trx
        .select({ totalItems: count() })
        .from(announcements)
        .where(and(...conditions));

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
          eq(announcements.status, ANNOUNCEMENT_STATUSES.PUBLISHED),
        ),
      );
  }

  async createAnnouncement(input: CreateAnnouncementRecordInput) {
    const [announcement] = await this.db
      .insert(announcements)
      .values({
        title: buildJsonbFieldWithMultipleEntries(input.title),
        content: buildJsonbFieldWithMultipleEntries(input.content),
        baseLanguage: input.baseLanguage,
        availableLocales: input.availableLocales,
        authorId: input.authorId,
        isEveryone: input.groupId === null,
        status: input.status,
        scheduledAt: input.scheduledAt,
        publishedAt: input.publishedAt,
        sendEmail: input.sendEmail,
        emailTemplate: input.emailTemplate,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })
      .returning();

    if (input.groupId) {
      await this.db.insert(groupAnnouncements).values({
        groupId: input.groupId,
        announcementId: announcement.id,
      });
    }

    return this.getAnnouncementSnapshot(announcement.id, input.baseLanguage);
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
      .set({ isRead: true, readAt: sql`now()` })
      .where(
        and(
          eq(userAnnouncements.announcementId, announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .returning();
  }

  async markAllAnnouncementsAsRead(userId: UUIDType) {
    const activeAnnouncementIds = this.db.$with("active_announcement_ids").as(
      this.db
        .select({ id: announcements.id })
        .from(announcements)
        .where(
          and(
            isNull(announcements.deletedAt),
            eq(announcements.status, ANNOUNCEMENT_STATUSES.PUBLISHED),
          ),
        ),
    );

    const updatedAnnouncements = await this.db
      .with(activeAnnouncementIds)
      .update(userAnnouncements)
      .set({ isRead: true, readAt: sql`now()` })
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
      .set({ deletedAt: sql`now()` })
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
      eq(announcements.status, ANNOUNCEMENT_STATUSES.PUBLISHED),
      ...filterConditions,
    );

    return this.db.transaction(async (trx) => {
      const announcementsQuery = trx
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
        .$dynamic();

      const announcementsData = await addPagination(
        announcementsQuery,
        pagination.page,
        pagination.perPage,
      );

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
    const conditions: SQL<unknown>[] = [];

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

    if (filters.search) {
      const searchCondition = or(
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
      );

      if (searchCondition) conditions.push(searchCondition);
    }

    return conditions.length ? conditions : [sql`1=1`];
  }

  async createUserAnnouncementRecords(userIds: UUIDType[], announcementId: UUIDType) {
    if (!userIds.length) return;

    const userAnnouncementsToInsert = userIds.map((userId) => ({
      userId,
      announcementId,
      isRead: false,
    }));

    await this.db.insert(userAnnouncements).values(userAnnouncementsToInsert).onConflictDoNothing();
  }

  async createUserAnnouncementRecordsForAnnouncement(announcementId: UUIDType) {
    const [announcement] = await this.getAnnouncementById(announcementId);

    if (!announcement) return;

    if (announcement.groupId) {
      const usersRelatedToGroup = await this.db
        .select({ userId: groupUsers.userId })
        .from(groupUsers)
        .leftJoin(users, eq(groupUsers.userId, users.id))
        .where(
          and(
            eq(groupUsers.groupId, announcement.groupId),
            this.permissionsService.excludeUsersWithPermission(PERMISSIONS.USER_MANAGE),
            isNull(users.deletedAt),
          ),
        );

      await this.createUserAnnouncementRecords(
        usersRelatedToGroup.map((user) => user.userId),
        announcement.id,
      );

      return;
    }

    const allUserIds = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(not(eq(users.id, announcement.authorId)), isNull(users.deletedAt)));

    await this.createUserAnnouncementRecords(
      allUserIds.map((user) => user.id),
      announcement.id,
    );
  }

  async findTenantsWithDueScheduledAnnouncements(
    limit: number,
  ): Promise<TenantWithDueScheduledAnnouncements[]> {
    return this.dbAdmin
      .selectDistinct({
        tenantId: announcements.tenantId,
      })
      .from(announcements)
      .where(
        and(
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          lte(announcements.scheduledAt, sql`now()`),
          isNull(announcements.deletedAt),
        ),
      )
      .limit(limit);
  }

  async claimDueScheduledAnnouncements(limit: number) {
    const dueAnnouncementIds = await this.db
      .select({ id: announcements.id })
      .from(announcements)
      .where(
        and(
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          lte(announcements.scheduledAt, sql`now()`),
          isNull(announcements.deletedAt),
        ),
      )
      .orderBy(asc(announcements.scheduledAt))
      .limit(limit);

    if (!dueAnnouncementIds.length) return [];

    return this.db
      .update(announcements)
      .set({
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        publishedAt: sql`now()`,
      })
      .where(
        and(
          inArray(
            announcements.id,
            dueAnnouncementIds.map((announcement) => announcement.id),
          ),
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          isNull(announcements.deletedAt),
        ),
      )
      .returning({ id: announcements.id });
  }

  async publishAnnouncementNow(announcementId: UUIDType) {
    return this.db
      .update(announcements)
      .set({
        status: ANNOUNCEMENT_STATUSES.PUBLISHED,
        publishedAt: sql`now()`,
      })
      .where(
        and(
          eq(announcements.id, announcementId),
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          isNull(announcements.deletedAt),
        ),
      )
      .returning({ id: announcements.id });
  }

  async updateScheduledAnnouncementBySource(
    lookup: AnnouncementSourceLookup,
    updates: Pick<CreateAnnouncementRecordInput, "title" | "content" | "scheduledAt">,
  ) {
    return this.db
      .update(announcements)
      .set({
        title: buildJsonbFieldWithMultipleEntries(updates.title),
        content: buildJsonbFieldWithMultipleEntries(updates.content),
        scheduledAt: updates.scheduledAt,
      })
      .where(
        and(
          eq(announcements.sourceType, lookup.sourceType),
          eq(announcements.sourceId, lookup.sourceId),
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          isNull(announcements.deletedAt),
        ),
      )
      .returning({ id: announcements.id });
  }

  async cancelScheduledAnnouncementBySource(lookup: AnnouncementSourceLookup) {
    return this.db
      .update(announcements)
      .set({ deletedAt: sql`now()` })
      .where(
        and(
          eq(announcements.sourceType, lookup.sourceType),
          eq(announcements.sourceId, lookup.sourceId),
          eq(announcements.status, ANNOUNCEMENT_STATUSES.SCHEDULED),
          isNull(announcements.deletedAt),
        ),
      )
      .returning({ id: announcements.id });
  }

  async getAnnouncementEmailRecipients(announcementId: UUIDType) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        language: sql<SupportedLanguages>`coalesce(${settingsTable.settings}->>'language', ${DEFAULT_STUDENT_SETTINGS.language})`,
      })
      .from(userAnnouncements)
      .innerJoin(users, eq(users.id, userAnnouncements.userId))
      .leftJoin(settingsTable, eq(settingsTable.userId, users.id))
      .where(and(eq(userAnnouncements.announcementId, announcementId), isNull(users.deletedAt)));
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
