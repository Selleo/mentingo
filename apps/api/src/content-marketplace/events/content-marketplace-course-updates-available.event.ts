import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  contentMarketplaceCourseUpdatesAvailableEventSchema,
  type contentMarketplaceCourseUpdatesAvailableDataSchema,
} from "../schemas/content-marketplace.schema";

import type { Static } from "@sinclair/typebox";

export type ContentMarketplaceCourseUpdatesAvailableData = Static<
  typeof contentMarketplaceCourseUpdatesAvailableDataSchema
>;

/** One tenant's marketplace courses whose newer listing versions admins have not been told about yet. */
@OutboxEvent({ payloadSchema: contentMarketplaceCourseUpdatesAvailableEventSchema })
export class ContentMarketplaceCourseUpdatesAvailableEvent {
  constructor(
    public readonly courseUpdatesAvailableData: ContentMarketplaceCourseUpdatesAvailableData,
  ) {}
}
