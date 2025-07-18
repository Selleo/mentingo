import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { DEFAULT_USER_SETTINGS } from "src/settings/constants/settings.constants";
import { settings } from "src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type SettingTest = InferSelectModel<typeof settings>;
export type SettingsTest = SettingTest[];

export const createSettingsFactory = (db: DatabasePg, userId: UUIDType) => {
  return Factory.define<SettingTest>(({ onCreate }) => {
    onCreate(async (setting) => {
      const [inserted] = await db.insert(settings).values(setting).returning();
      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      settings: DEFAULT_USER_SETTINGS,
      userId: userId,
    };
  });
};
