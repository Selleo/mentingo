import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_STUDENT_SETTINGS,
} from "src/settings/constants/settings.constants";
import { settingsToJsonBuildObject } from "src/utils/settings-to-json-build-object";

import { settings } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type SettingsTest = InferSelectModel<typeof settings>;

export const createSettingsFactory = (
  db: DatabasePg,
  userId: UUIDType | null = null,
  isAdmin: boolean = false,
) => {
  return Factory.define<SettingsTest>(({ onCreate }) => {
    onCreate(async () => {
      const defaultSettings =
        (userId === null && DEFAULT_GLOBAL_SETTINGS) ||
        (isAdmin && DEFAULT_ADMIN_SETTINGS) ||
        DEFAULT_STUDENT_SETTINGS;

      const finalSettings = {
        ...defaultSettings,
      };
      const settingsSQL = settingsToJsonBuildObject(finalSettings);

      const [inserted] = await db
        .insert(settings)
        .values({
          userId: userId,
          createdAt: new Date().toISOString(),
          settings: settingsSQL,
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      settings: isAdmin ? DEFAULT_ADMIN_SETTINGS : DEFAULT_STUDENT_SETTINGS,
    };
  });
};
