import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  courseTransferVideoMetadataRequestedEventSchema,
  type courseTransferVideoMetadataRequestedDataSchema,
} from "../schemas/course-transfer.schema";

import type { Static } from "@sinclair/typebox";

export type CourseTransferVideoMetadataRequestedData = Static<
  typeof courseTransferVideoMetadataRequestedDataSchema
>;

/** Discover recipient video metadata after its resource and course graph commit. */
@OutboxEvent({
  clearPayloadAfterDelivery: true,
  payloadSchema: courseTransferVideoMetadataRequestedEventSchema,
})
export class CourseTransferVideoMetadataRequestedEvent {
  constructor(public readonly videoMetadataRequestData: CourseTransferVideoMetadataRequestedData) {}
}
