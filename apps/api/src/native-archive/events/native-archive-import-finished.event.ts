import { OutboxEvent } from "src/outbox/outbox.decorators";

import {
  nativeArchiveImportFinishedEventSchema,
  type nativeArchiveImportFinishedDataSchema,
} from "../schemas/native-archive.schema";

import type { Static } from "@sinclair/typebox";

export type NativeArchiveImportFinishedData = Static<typeof nativeArchiveImportFinishedDataSchema>;

/**
 * Reports how an import that was queued with an import source ended, so the feature that queued it
 * can react once the imported course has committed. Imports without a source publish nothing.
 */
@OutboxEvent({
  clearPayloadAfterDelivery: true,
  payloadSchema: nativeArchiveImportFinishedEventSchema,
})
export class NativeArchiveImportFinishedEvent {
  constructor(public readonly importFinishedData: NativeArchiveImportFinishedData) {}
}
