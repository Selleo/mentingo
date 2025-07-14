import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { settings } from "src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";
import type { SettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

type SettingTest = InferSelectModel<typeof settings>;
export type SettingsTest = SettingTest[];

export const createSettingsFactory = (db: DatabasePg) => {
  return Factory.define<SettingTest>(({ onCreate }) => {
    onCreate(async (setting) => {
      const [inserted] = await db.insert(settings).values(setting).returning();
      return inserted;
    });

    const settingsContent: SettingsJSONContentSchema = {
      admin_new_user_notification: faker.helpers.arrayElement([
        faker.datatype.boolean(),
        undefined,
      ]),
      language: faker.helpers.arrayElement(["en", "pl", undefined]),
    };
    return {
      id: faker.string.uuid(),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      settings: settingsContent,
      userId: faker.helpers.arrayElement([faker.string.uuid(), null]),
    };
  });
};
