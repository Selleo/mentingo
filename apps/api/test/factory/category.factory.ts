import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { categories } from "../../src/storage/schema";
import { ensureTenant } from "../helpers/tenant-helpers";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type CategoryTest = InferSelectModel<typeof categories>;
export type CategoriesTest = CategoryTest[];

export const createCategoryFactory = (db: DatabasePg) => {
  return Factory.define<CategoryTest>(({ onCreate }) => {
    onCreate(async (category) => {
      const tenantId = await ensureTenant(db, category.tenantId as UUIDType | undefined);

      const [inserted] = await db
        .insert(categories)
        .values({
          ...category,
          tenantId,
        })
        .returning();
      return inserted;
    });

    const randomHex = Math.floor(Math.random() * 100000000).toString(16);

    return {
      id: faker.string.uuid(),
      title: faker.commerce.department() + randomHex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      tenantId: undefined as unknown as UUIDType,
    };
  });
};
