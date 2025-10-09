import { faker } from "@faker-js/faker";
import { eq, and, not } from "drizzle-orm";
import { Factory } from "fishery";

import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  announcements,
  groupAnnouncements,
  groupUsers,
  userAnnouncements,
  users,
} from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type Announcement = InferSelectModel<typeof announcements>;

export const createAnnouncementFactory = (db: DatabasePg) => {
  return Factory.define<Announcement>(({ onCreate }) => {
    onCreate(async (announcement) => {
      const { groupId, ...announcementData } = announcement as any;

      const [createdAnnouncement] = await db
        .insert(announcements)
        .values({ ...announcementData, groupId })
        .returning();

      if (groupId) {
        await createUserAnnouncementsForGroup(db, groupId, createdAnnouncement.id);

        return createdAnnouncement;
      }

      await createUserAnnouncementsForAll(db, createdAnnouncement.authorId, createdAnnouncement.id);

      return createdAnnouncement;
    });

    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(3),
      content: faker.lorem.paragraph(),
      authorId: faker.string.uuid(),
      groupId: null,
      isEveryone: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

async function createUserAnnouncementsForGroup(
  db: DatabasePg,
  groupId: string,
  announcementId: string,
) {
  await db.insert(groupAnnouncements).values({ groupId, announcementId });

  const usersRelatedToGroup = await db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .leftJoin(users, eq(groupUsers.userId, users.id))
    .where(and(eq(groupUsers.groupId, groupId), not(eq(users.role, USER_ROLES.ADMIN))));

  const userAnnouncementsToInsert = usersRelatedToGroup.map((u) => ({
    userId: u.userId,
    announcementId,
    isRead: false,
  }));

  if (userAnnouncementsToInsert.length)
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
}

async function createUserAnnouncementsForAll(
  db: DatabasePg,
  authorId: string,
  announcementId: string,
) {
  const allUserIds = await db
    .select({ id: users.id })
    .from(users)
    .where(not(eq(users.id, authorId)));

  const userAnnouncementsToInsert = allUserIds.map((u) => ({
    userId: u.id,
    announcementId,
    isRead: false,
  }));

  if (userAnnouncementsToInsert.length)
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
}
