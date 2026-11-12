import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  courseTransferRequestedEventSchema,
  type courseTransferRequestedDataSchema,
} from "../schemas/course-transfer.schema";

import type { Static } from "@sinclair/typebox";

export type CourseTransferRequestedData = Static<typeof courseTransferRequestedDataSchema>;

@OutboxEvent({ clearPayloadAfterDelivery: true, payloadSchema: courseTransferRequestedEventSchema })
export class CourseTransferRequestedEvent {
  constructor(public readonly transferRequestData: CourseTransferRequestedData) {}
}
