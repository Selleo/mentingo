import { faker } from "@faker-js/faker";
import { getTableColumns } from "drizzle-orm";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { questionsAndAnswers } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type QATest = Omit<InferSelectModel<typeof questionsAndAnswers>, "tenantId">;

export const createQAFactory = (db: DatabasePg) =>
  Factory.define<QATest>(({ onCreate }) => {
    onCreate(async (qa) => {
      const baseLanguage = (qa.baseLanguage ?? "en") as SupportedLanguages;
      const availableLocales =
        qa.availableLocales && qa.availableLocales.length > 0
          ? qa.availableLocales
          : [baseLanguage];

      const [inserted] = await db
        .insert(questionsAndAnswers)
        .values({
          ...qa,
          title: buildJsonbField(baseLanguage, qa.title as string),
          description: buildJsonbField(baseLanguage, qa.description as string),
          baseLanguage,
          availableLocales,
        })
        .returning({
          ...getTableColumns(questionsAndAnswers),
        });

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: faker.lorem.sentence(),
      description: faker.lorem.sentences(2),
      metadata: {},
      baseLanguage: "en",
      availableLocales: ["en"],
    };
  });
