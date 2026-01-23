import { faker } from "@faker-js/faker";
import { getTableColumns } from "drizzle-orm";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { questionsAndAnswers } from "src/storage/schema";

import { ensureTenant } from "../helpers/tenant-helpers";

import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type QATest = InferSelectModel<typeof questionsAndAnswers>;

export const createQAFactory = (db: DatabasePg) =>
  Factory.define<QATest>(({ onCreate }) => {
    onCreate(async (qa) => {
      const tenantId = await ensureTenant(db, qa.tenantId);
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
          tenantId,
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
      tenantId: undefined as unknown as UUIDType,
    } as QATest;
  });
