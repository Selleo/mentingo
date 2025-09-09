import { Inject, Injectable } from "@nestjs/common";
import {
  eq,
  and,
  or,
  isNull,
  getTableColumns,
  countDistinct,
  isNotNull,
  sql,
  inArray,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  announcements,
  groupAnnouncements,
  groups,
  groupUsers,
  userAnnouncements,
  users,
} from "src/storage/schema";
import { UserService } from "src/user/user.service";

import { LATEST_ANNOUNCEMENTS_LIMIT } from "./consts";

import type { Announcement, CreateAnnouncement } from "./types/announcement.types";
import type { UUIDType } from "src/common";

@Injectable()
export class AnnouncementsRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly userService: UserService,
  ) {}

  async getAllAnnouncements() {
    const announcementsData = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.authorId, users.id))
      .orderBy(announcements.createdAt);

    return await this.mapAnnouncementsWithProfilePictures(announcementsData);
  }

  async getLatestUnreadAnnouncements(userId: UUIDType) {
    const announcementsData = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
      })
      .from(announcements)
      .leftJoin(
        userAnnouncements,
        and(
          eq(announcements.id, userAnnouncements.announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .leftJoin(users, eq(announcements.authorId, users.id))
      .where(eq(userAnnouncements.isRead, false))
      .orderBy(announcements.createdAt)
      .limit(LATEST_ANNOUNCEMENTS_LIMIT);

    return await this.mapAnnouncementsWithProfilePictures(announcementsData);
  }

  async getUnreadAnnouncementsCount(userId: UUIDType) {
    return await this.db
      .select({
        unreadCount: countDistinct(announcements.id),
      })
      .from(userAnnouncements)
      .where(and(eq(userAnnouncements.userId, userId), eq(userAnnouncements.isRead, false)));
  }

  async getAnnouncementById(id: string) {
    const announcementData = await this.db
      .select({
        ...getTableColumns(announcements),
        ...this.getAuthorFields(),
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.authorId, users.id))
      .where(eq(announcements.id, id));

    return await this.mapAnnouncementsWithProfilePictures(announcementData);
  }

  async createAnnouncement(createAnnouncementData: CreateAnnouncement, authorId: UUIDType) {
    const { target, ...announcementData } = createAnnouncementData;

    const [announcement] = await this.db
      .insert(announcements)
      .values({ ...announcementData, authorId, isEveryone: target.type === "everyone" })
      .returning();

    if (target.type === "group" && target.groupId) {
      await this.db.insert(groupAnnouncements).values({
        groupId: target.groupId,
        announcementId: announcement.id,
      });

      const usersRelatedToGroup = await this.db
        .select({ userId: groupUsers.userId })
        .from(groupUsers)
        .where(eq(groupUsers.groupId, target.groupId));

      await this.createUserAnnouncementRecords(usersRelatedToGroup.map((user) => user.userId));

      return announcement;
    }

    const allUserIds = await this.db.select({ id: users.id }).from(users);
    await this.createUserAnnouncementRecords(allUserIds.map((user) => user.id));

    return announcement;
  }

  async markAnnouncementAsRead(announcementId: string, userId: UUIDType) {
    return await this.db
      .update(userAnnouncements)
      .set({ isRead: true })
      .where(
        and(
          eq(userAnnouncements.announcementId, announcementId),
          eq(userAnnouncements.userId, userId),
        ),
      )
      .returning();
  }

  async createUserAnnouncementRecords(userIds: UUIDType[]) {
    if (!userIds.length) return;

    const announcementsRelatedToUsers = await this.db
      .select({ ...getTableColumns(announcements) })
      .from(announcements)
      .leftJoin(
        userAnnouncements,
        and(
          eq(announcements.id, userAnnouncements.announcementId),
          inArray(userAnnouncements.userId, userIds),
        ),
      )
      .leftJoin(groupAnnouncements, eq(announcements.id, groupAnnouncements.announcementId))
      .leftJoin(groups, eq(groupAnnouncements.groupId, groups.id))
      .leftJoin(
        groupUsers,
        and(
          eq(groupAnnouncements.groupId, groupUsers.groupId),
          inArray(groupUsers.userId, userIds),
        ),
      )
      .where(
        and(
          or(eq(announcements.isEveryone, true), isNotNull(groupUsers.userId)),
          isNull(userAnnouncements.userId),
        ),
      );

    if (!announcementsRelatedToUsers.length) return;

    const userAnnouncementsToInsert = userIds.flatMap((userId) =>
      announcementsRelatedToUsers.map((announcement) => ({
        userId,
        announcementId: announcement.id,
        isRead: false,
      })),
    );

    await this.db.insert(userAnnouncements).values(userAnnouncementsToInsert);
  }

  getAuthorFields() {
    return {
      authorName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      authorProfilePictureUrl: users.avatarReference,
    };
  }

  async mapAnnouncementsWithProfilePictures(announcementsData: Announcement[]) {
    return Promise.all(
      announcementsData.map(async (announcement) => ({
        ...announcement,
        authorProfilePictureUrl: await this.userService.getUsersProfilePictureUrl(
          announcement.authorProfilePictureUrl,
        ),
      })),
    );
  }
}
