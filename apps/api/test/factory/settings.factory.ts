import { faker } from "@faker-js/faker";
import { Factory } from "fishery";
import { match } from "ts-pattern";

import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_STUDENT_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
} from "src/settings/constants/settings.constants";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { settings } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type SettingsTest = InferSelectModel<typeof settings>;

export const createSettingsFactory = (
  db: DatabasePg,
  userId: UUIDType | null = null,
  isAdmin: boolean = false,
) => {
  const defaultSettings = match({ isAdmin, userId })
    .with({ isAdmin: false, userId: null }, () => DEFAULT_GLOBAL_SETTINGS)
    .with({ isAdmin: true }, () => DEFAULT_ADMIN_SETTINGS)
    .with({ isAdmin: false }, () => DEFAULT_STUDENT_SETTINGS)
    .exhaustive();

  return Factory.define<SettingsTest>(({ onCreate }) => {
    onCreate(async () => {
      const [inserted] = await db
        .insert(settings)
        .values({
          userId: userId,
          createdAt: new Date().toISOString(),
          settings: settingsToJSONBuildObject(defaultSettings),
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      settings: defaultSettings,
    };
  });
};
