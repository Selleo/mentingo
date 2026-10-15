import { faker } from "@faker-js/faker";
import { VIDEO_PROVIDERS } from "@repo/shared";
import { Factory } from "fishery";

import { HOSTED_VIDEO_STATUSES } from "src/file/hosted-video.constants";
import { buildBunnyVideoReference } from "src/file/video-metadata.utils";
import { hostedVideos } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type HostedVideoTest = InferInsertModel<typeof hostedVideos>;

/** Hosted videos span tenants, so the factory takes the admin database handle. */
export const createHostedVideoFactory = (dbAdmin: DatabasePg) => {
  return Factory.define<HostedVideoTest, never, InferSelectModel<typeof hostedVideos>>(
    ({ onCreate }) => {
      onCreate(async (hostedVideo) => {
        const [inserted] = await dbAdmin.insert(hostedVideos).values(hostedVideo).returning();
        return inserted;
      });

      const providerVideoId = faker.string.uuid();

      return {
        id: faker.string.uuid(),
        tenantId: "",
        provider: VIDEO_PROVIDERS.BUNNY,
        providerVideoId,
        reference: buildBunnyVideoReference(providerVideoId),
        providerConfigurationSignature: "target-library",
        status: HOSTED_VIDEO_STATUSES.PROCESSING,
        statusChangedAt: new Date().toISOString(),
        copiedFromTenantId: null,
        copiedFromReference: `bunny-${faker.string.uuid()}`,
        lastCheckedAt: null,
      };
    },
  );
};
