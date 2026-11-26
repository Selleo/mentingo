import { faker } from "@faker-js/faker";
import {
  SCORM_PACKAGE_ENTITY_TYPE,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { scormPackages } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type ScormPackageTest = Omit<InferInsertModel<typeof scormPackages>, "tenantId">;

export const createScormPackageFactory = (db: DatabasePg) =>
  Factory.define<ScormPackageTest, never, InferSelectModel<typeof scormPackages>>(
    ({ onCreate }) => {
      onCreate(async (scormPackage) => {
        const [inserted] = await db.insert(scormPackages).values(scormPackage).returning();

        return inserted;
      });

      const packageDirectory = `scorm/${faker.string.uuid()}`;

      return {
        id: faker.string.uuid(),
        entityType: SCORM_PACKAGE_ENTITY_TYPE.LESSON,
        entityId: "",
        language: SUPPORTED_LANGUAGES.EN,
        standard: SCORM_STANDARD.SCORM_1_2,
        originalFileReference: `${packageDirectory}/original.zip`,
        extractedFilesReference: `${packageDirectory}/extracted`,
        manifestEntryPoint: `${packageDirectory}/extracted/index.html`,
        status: SCORM_PACKAGE_STATUS.READY,
      };
    },
  );
