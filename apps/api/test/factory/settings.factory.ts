import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { Factory } from "fishery";

import {
  DEFAULT_USER_ADMIN_SETTINGS,
  DEFAULT_USER_SETTINGS,
} from "src/settings/constants/settings.constants";

import { settings } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type SettingsTest = InferSelectModel<typeof settings>;

export const createSettingsFactory = (
  db: DatabasePg,
  userId: UUIDType,
  isAdmin: boolean = false,
) => {
  return Factory.define<SettingsTest>(({ onCreate }) => {
    onCreate(async () => {
      const defaultSettings = isAdmin ? DEFAULT_USER_ADMIN_SETTINGS : DEFAULT_USER_SETTINGS;

      const finalSettings = {
        ...defaultSettings,
      };

      const [inserted] = await db
        .insert(settings)
        .values({
          userId: userId,
          createdAt: new Date().toISOString(),
          settings: sql.raw(`'${JSON.stringify(finalSettings).replace(/'/g, "''")}'::jsonb`),
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId,
      settings: isAdmin ? DEFAULT_USER_ADMIN_SETTINGS : DEFAULT_USER_SETTINGS,
    };
  });
};
