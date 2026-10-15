import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES, type LocalizedText } from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { resourceEntity, resources } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ResourceTest = Omit<
  InferInsertModel<typeof resources>,
  "tenantId" | "title" | "description"
> & {
  title: LocalizedText;
  description: LocalizedText;
};

type ResourceLink = {
  entityId: UUIDType;
  entityType: string;
  relationshipType?: string;
};

type ResourceTransientParams = { linkedTo?: ResourceLink };

class ResourceFactory extends Factory<
  ResourceTest,
  ResourceTransientParams,
  InferSelectModel<typeof resources>
> {
  /** Also links the resource to an entity, the way uploads attach files to lessons or courses. */
  linkedTo(link: ResourceLink) {
    return this.transient({ linkedTo: link });
  }
}

export const createResourceFactory = (db: DatabasePg) => {
  return ResourceFactory.define(({ onCreate, transientParams }) => {
    onCreate(async (resource) => {
      const [inserted] = await db
        .insert(resources)
        .values({
          ...resource,
          title: buildJsonbFieldWithMultipleEntries(resource.title),
          description: buildJsonbFieldWithMultipleEntries(resource.description),
        })
        .returning();

      if (transientParams.linkedTo) {
        await db.insert(resourceEntity).values({
          resourceId: inserted.id,
          entityId: transientParams.linkedTo.entityId,
          entityType: transientParams.linkedTo.entityType,
          relationshipType:
            transientParams.linkedTo.relationshipType ?? RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        });
      }

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      title: { [SUPPORTED_LANGUAGES.EN]: faker.system.fileName() },
      description: { [SUPPORTED_LANGUAGES.EN]: faker.lorem.sentence() },
      reference: `lesson/${faker.string.uuid()}.png`,
      contentType: "image/png",
      metadata: {},
      uploadedBy: null,
      archived: false,
    };
  });
};
