import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { getTableColumns, sql } from "drizzle-orm";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { groups, groupUsers } from "src/storage/schema";

import type { DatabasePg } from "src/common";

type GroupFactoryGroup = {
  id: string;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  characteristic: string | null;
  createdAt: string;
  name: string;
  tenantId?: string;
  updatedAt: string;
};

type GroupWithMembers = GroupFactoryGroup & { members: string[] };

class GroupFactory extends Factory<GroupWithMembers> {
  withMembers(userIds: string[]) {
    return this.associations({ members: userIds });
  }
}

export const createGroupFactory = (db: DatabasePg) => {
  return GroupFactory.define(({ onCreate, associations }) => {
    onCreate(async (g) => {
      return await createGroupWithMembers(db, g, associations.members || []);
    });

    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      characteristic: null,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      createdAt: new Date().toISOString(),
      members: [],
      updatedAt: new Date().toISOString(),
    };
  });
};

async function addUsersToGroup(db: DatabasePg, groupId: string, userIds: string[]) {
  if (!userIds.length) return;

  const values = userIds.map((userId) => ({
    groupId,
    userId,
  }));

  await db.insert(groupUsers).values(values);
}

async function createGroupWithMembers(
  db: DatabasePg,
  group: GroupWithMembers,
  memberIds: string[],
): Promise<GroupWithMembers> {
  const {
    members: _members,
    name,
    characteristic,
    baseLanguage,
    availableLocales,
    ...groupInsert
  } = group;

  const [createdGroup] = await db
    .insert(groups)
    .values({
      ...groupInsert,
      name: buildJsonbField(baseLanguage, name),
      characteristic: buildJsonbField(baseLanguage, characteristic, true),
      baseLanguage,
      availableLocales,
    })
    .returning({
      ...getTableColumns(groups),
      name: sql<string>`${groups.name}->>${baseLanguage}::text`,
      characteristic: sql<string | null>`${groups.characteristic}->>${baseLanguage}::text`,
    });

  await addUsersToGroup(db, createdGroup.id, memberIds);

  return { ...createdGroup, members: memberIds };
}
