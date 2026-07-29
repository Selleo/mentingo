import { faker } from "@faker-js/faker";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_EMAIL_TEMPLATES,
  ANNOUNCEMENT_SOURCE_TYPES,
  ANNOUNCEMENT_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { eq, and, isNull, ne } from "drizzle-orm";
import { Factory } from "fishery";

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
  userIds?: string[];
};

class AnnouncementFactory extends Factory<AnnouncementWithAssoc> {
  withGroup(groupId: string) {
    return this.associations({ groupId } as Partial<AnnouncementWithAssoc>);
  }

  withEveryone() {
    return this.associations({
      audience: ANNOUNCEMENT_AUDIENCES.ALL_USERS,
    } as Partial<AnnouncementWithAssoc>);
  }

  withUsers(userIds: string[]) {
    return this.associations({
      audience: ANNOUNCEMENT_AUDIENCES.SELECTED_USERS,
      userIds,
    } as Partial<AnnouncementWithAssoc>);
  }
}

export const createAnnouncementFactory = (db: DatabasePg) => {
  return AnnouncementFactory.define(({ onCreate, associations }) => {
    onCreate(async (announcement: AnnouncementInsert) => {
      const tenantId = await ensureTenant(db, announcement.tenantId);

      const [inserted] = await db
        .insert(announcements)
        .values({ ...announcement, tenantId })
        .returning();

      const groupId = associations?.groupId;
      const userIds = associations?.userIds;

      if (userIds) {
        await createUserAnnouncements(db, userIds, inserted.id, tenantId);

        return inserted;
      }

      if (groupId) {
        await createUserAnnouncementsForGroup(db, groupId, inserted.id, tenantId);

        return inserted;
      }

      await createUserAnnouncementsForAll(db, inserted.id, inserted.authorId, tenantId);

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      title: {
        [SUPPORTED_LANGUAGES.EN]: faker.lorem.sentence(3),
      },
      content: {
        [SUPPORTED_LANGUAGES.EN]: faker.lorem.paragraph(),
      },
      authorId: faker.string.uuid(),
      audience: ANNOUNCEMENT_AUDIENCES.ALL_USERS,
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      sendEmail: false,
      emailTemplate: ANNOUNCEMENT_EMAIL_TEMPLATES.DEFAULT,
      sourceType: ANNOUNCEMENT_SOURCE_TYPES.MANUAL,
      sourceId: null,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

async function createUserAnnouncements(
  db: DatabasePg,
  userIds: string[],
  announcementId: string,
  tenantId: UUIDType,
) {
  if (!userIds.length) return;

  await db.insert(userAnnouncements).values(
    userIds.map((userId) => ({
      userId,
      announcementId,
      isRead: false,
      tenantId,
    })),
  );
}

async function createUserAnnouncementsForGroup(
  db: DatabasePg,
  groupId: string,
  announcementId: string,
  tenantId: UUIDType,
) {
  await db.insert(groupAnnouncements).values({
    groupId,
    announcementId,
    tenantId,
  });

  const usersRelatedToGroup = await db
    .select({
      userId: groupUsers.userId,
    })
    .from(groupUsers)
    .leftJoin(users, eq(groupUsers.userId, users.id))
    .where(and(eq(groupUsers.groupId, groupId), isNull(users.deletedAt)));

  const userAnnouncementsToInsert = usersRelatedToGroup.map((u) => ({
    userId: u.userId,
    announcementId,
    isRead: false,
    tenantId,
  }));

  if (userAnnouncementsToInsert.length) {
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
  }
}

async function createUserAnnouncementsForAll(
  db: DatabasePg,
  announcementId: string,
  authorId: string,
  tenantId: UUIDType,
) {
  const allUserIds = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(and(ne(users.id, authorId), isNull(users.deletedAt)));

  const userAnnouncementsToInsert = allUserIds.map((u) => ({
    userId: u.id,
    announcementId,
    isRead: false,
    tenantId,
  }));

  if (userAnnouncementsToInsert.length) {
    await db.insert(userAnnouncements).values(userAnnouncementsToInsert);
  }
}
