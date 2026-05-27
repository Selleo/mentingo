import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbField } from "../../src/common/helpers/sqlHelpers";
import { categories } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type CategoryTest = Omit<InferSelectModel<typeof categories>, "tenantId" | "title"> & {
  title: string;
};
export type CategoriesTest = CategoryTest[];

export const createCategoryFactory = (db: DatabasePg) => {
  return Factory.define<CategoryTest>(({ onCreate }) => {
    onCreate(async (category) => {
      const [inserted] = await db
        .insert(categories)
        .values({
          ...category,
          title: buildJsonbField(SUPPORTED_LANGUAGES.EN, category.title),
        })
        .returning();

      return { ...inserted, title: category.title };
    });

    const randomHex = Math.floor(Math.random() * 100000000).toString(16);

    return {
      id: faker.string.uuid(),
      title: faker.commerce.department() + randomHex,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    };
  });
};
