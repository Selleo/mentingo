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

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type Announcement = InferSelectModel<typeof announcements>;
type AnnouncementInsert = InferInsertModel<typeof announcements>;

type AnnouncementWithAssoc = Announcement & {
  groupId?: string;
  isEveryone?: boolean;
};

class AnnouncementFactory extends Factory<AnnouncementWithAssoc> {
  withGroup(groupId: string) {
    return this.associations({ groupId } as Partial<AnnouncementWithAssoc>);
  }

  withEveryone() {
    return this.associations({ isEveryone: true } as Partial<AnnouncementWithAssoc>);
  }
}

export const createAnnouncementFactory = (db: DatabasePg) => {
  return AnnouncementFactory.define(({ onCreate, associations }) => {
    onCreate(async (announcement: AnnouncementInsert) => {
      const [inserted] = await db.insert(announcements).values(announcement).returning();

      const groupId = associations?.groupId;

      if (groupId) {
        await createUserAnnouncementsForGroup(db, groupId, inserted.id);
        return inserted;
      }

      await createUserAnnouncementsForAll(db, inserted.authorId, inserted.id);
      return inserted;
    });

    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(3),
      content: faker.lorem.paragraph(),
      authorId: faker.string.uuid(),
      isEveryone: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Announcement;
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
    .where(and(not(eq(users.id, authorId)), not(eq(users.role, USER_ROLES.ADMIN))));

  const userAnnouncementsToInsert = allUserIds.map((u) => ({
    userId: u.id,
    announcementId,
    isRead: false,
  }));

  if (userAnnouncementsToInsert.length)
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
}
