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
import { ensureTenant } from "../helpers/tenant-helpers";

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type Announcement = Omit<InferSelectModel<typeof announcements>, "tenantId">;
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
      const tenantId = await ensureTenant(db, announcement.tenantId as UUIDType | undefined);
      const [inserted] = await db
        .insert(announcements)
        .values({ ...announcement, tenantId })
        .returning();

      const groupId = associations?.groupId;

      if (groupId) {
        await createUserAnnouncementsForGroup(db, groupId, inserted.id, tenantId);
        return inserted;
      }

      await createUserAnnouncementsForAll(db, inserted.authorId, inserted.id, tenantId);
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
    };
  });
};

async function createUserAnnouncementsForGroup(
  db: DatabasePg,
  groupId: string,
  announcementId: string,
  tenantId: UUIDType,
) {
  await db.insert(groupAnnouncements).values({ groupId, announcementId, tenantId });

  const usersRelatedToGroup = await db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .leftJoin(users, eq(groupUsers.userId, users.id))
    .where(and(eq(groupUsers.groupId, groupId), not(eq(users.role, USER_ROLES.ADMIN))));

  const userAnnouncementsToInsert = usersRelatedToGroup.map((u) => ({
    userId: u.userId,
    announcementId,
    isRead: false,
    tenantId,
  }));

  if (userAnnouncementsToInsert.length)
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
}

async function createUserAnnouncementsForAll(
  db: DatabasePg,
  authorId: string,
  announcementId: string,
  tenantId: UUIDType,
) {
  const allUserIds = await db
    .select({ id: users.id })
    .from(users)
    .where(and(not(eq(users.id, authorId)), not(eq(users.role, USER_ROLES.ADMIN))));

  const userAnnouncementsToInsert = allUserIds.map((u) => ({
    userId: u.id,
    announcementId,
    isRead: false,
    tenantId,
  }));

  if (userAnnouncementsToInsert.length)
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
}
