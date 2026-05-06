import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { learningPaths, users } from "src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type LearningPathTest = Omit<InferSelectModel<typeof learningPaths>, "tenantId">;

const ensureAuthor = async (db: DatabasePg, authorId?: UUIDType): Promise<UUIDType> => {
  if (authorId) return authorId;

  const [author] = await db
    .insert(users)
    .values({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return author.id;
};

export const createLearningPathFactory = (db: DatabasePg) => {
  return Factory.define<LearningPathTest>(({ onCreate }) => {
    onCreate(async (learningPath) => {
      const authorId = await ensureAuthor(db, learningPath.authorId);

      const [inserted] = await db
        .insert(learningPaths)
        .values({
          ...learningPath,
          authorId,
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: { pl: "Path title" },
      description: { pl: "Path description" },
      thumbnailReference: null,
      status: "published",
      includesCertificate: false,
      sequenceEnabled: false,
      authorId: "",
      originType: "regular",
      sourceLearningPathId: null,
      sourceTenantId: null,
      baseLanguage: "pl",
      availableLocales: ["pl"],
    };
  });
};
