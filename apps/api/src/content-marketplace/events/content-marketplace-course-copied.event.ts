import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  contentMarketplaceCourseCopiedEventSchema,
  type contentMarketplaceCourseCopiedDataSchema,
} from "../schemas/content-marketplace.schema";

import type { Static } from "@sinclair/typebox";

export type ContentMarketplaceCourseCopiedData = Static<
  typeof contentMarketplaceCourseCopiedDataSchema
>;

/** A marketplace copy that ended before its import could report it, such as a failed archive download. */
@OutboxEvent({
  clearPayloadAfterDelivery: true,
  payloadSchema: contentMarketplaceCourseCopiedEventSchema,
})
export class ContentMarketplaceCourseCopiedEvent {
  constructor(public readonly courseCopiedData: ContentMarketplaceCourseCopiedData) {}
}
