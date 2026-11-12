import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  courseDuplicatedEventSchema,
  type courseDuplicatedDataSchema,
} from "./course-duplicated.schema";

import type { Static } from "@sinclair/typebox";

export type CourseDuplicatedData = Static<typeof courseDuplicatedDataSchema>;

/** A duplicate course finished copying its source course's content. */
@OutboxEvent({ clearPayloadAfterDelivery: true, payloadSchema: courseDuplicatedEventSchema })
export class CourseDuplicatedEvent {
  constructor(public readonly courseDuplicatedData: CourseDuplicatedData) {}
}
