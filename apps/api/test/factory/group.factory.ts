import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { groups, groupUsers } from "src/storage/schema";

import { ensureTenant } from "../helpers/tenant-helpers";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type Group = InferSelectModel<typeof groups>;
type GroupInsert = InferInsertModel<typeof groups>;

type GroupWithMembers = Group & { members: string[] };

class GroupFactory extends Factory<GroupWithMembers> {
  withMembers(userIds: string[]) {
    return this.associations({ members: userIds });
  }
}

export const createGroupFactory = (db: DatabasePg) => {
  return GroupFactory.define(
    ({
      onCreate,
      associations,
    }: {
      onCreate: (fn: (g: GroupInsert) => Promise<Group> | Group) => void;
      associations?: Partial<GroupWithMembers>;
    }) => {
      onCreate(async (g: GroupInsert) => {
        const tenantId = await ensureTenant(db, g.tenantId);
        return await createGroupWithMembers(db, { ...g, tenantId }, associations?.members || []);
      });

      return {
        id: faker.string.uuid(),
        name: faker.company.name(),
        characteristic: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: undefined as unknown as UUIDType,
      };
    },
  );
};

async function addUsersToGroup(
  db: DatabasePg,
  groupId: string,
  userIds: string[],
  tenantId: UUIDType,
) {
  if (!userIds.length) return;

  const values = userIds.map((userId) => ({
    groupId,
    userId,
    tenantId,
  }));

  await db.insert(groupUsers).values(values);
}

async function createGroupWithMembers(db: DatabasePg, group: GroupInsert, memberIds: string[]) {
  const [createdGroup] = await db.insert(groups).values(group).returning();

  await addUsersToGroup(db, createdGroup.id, memberIds, group.tenantId);

  return createdGroup;
}
