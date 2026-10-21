import { UUIDType } from "src/common";

import { NativeArchiveImportOutcome, NativeArchiveImportSource } from "../native-archive.types";

/**
 * Reports how an import that was queued with an import source ended, so the feature that queued it
 * can react once the imported course has committed. Imports without a source publish nothing.
 */
export class NativeArchiveImportFinishedEvent {
  constructor(
    public readonly tenantId: UUIDType,
    public readonly jobId: string,
    public readonly actorId: UUIDType,
    public readonly outcome: NativeArchiveImportOutcome,
    public readonly courseId: UUIDType | null,
    public readonly failureCode: string | null,
    public readonly importSource: NativeArchiveImportSource,
    public readonly finishedAt: string,
  ) {}
}
