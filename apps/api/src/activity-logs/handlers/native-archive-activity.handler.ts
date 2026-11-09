import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { match, P } from "ts-pattern";

import { NativeArchiveExportedEvent, NativeArchiveImportedEvent } from "src/events";
import {
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_KIND,
} from "src/native-archive/native-archive.constants";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

import type { NativeArchiveExport, NativeArchiveImport } from "src/events";
import type { NativeArchiveKind } from "src/native-archive/native-archive.types";

type NativeArchiveEventType = NativeArchiveExportedEvent | NativeArchiveImportedEvent;

@Injectable()
@EventsHandler(NativeArchiveExportedEvent, NativeArchiveImportedEvent)
export class NativeArchiveActivityHandler implements IEventHandler<NativeArchiveEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: NativeArchiveEventType) {
    await match(event)
      .with(P.instanceOf(NativeArchiveExportedEvent), ({ archiveExport }) =>
        this.recordArchiveExport(archiveExport),
      )
      .with(P.instanceOf(NativeArchiveImportedEvent), ({ archiveImport }) =>
        this.recordArchiveImport(archiveImport),
      )
      .exhaustive();
  }

  /** Only exports pre-authorized by an integration key differ from a regular admin export. */
  private async recordArchiveExport({ actor, kind, rootId, exportAccess }: NativeArchiveExport) {
    await this.activityLogsService.recordActivity({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.EXPORT,
      resourceType: this.getArchiveResourceType(kind),
      resourceId: rootId,
      context:
        exportAccess === NATIVE_ARCHIVE_EXPORT_ACCESS.PRE_AUTHORIZED ? { exportAccess } : null,
    });
  }

  /** Keeps only details that say more than the logged resource: empty lists and defaults are left out. */
  private async recordArchiveImport({
    actor,
    kind,
    rootId,
    importMode,
    importSourceKind,
    alreadyExists,
    createdCourseIds,
    reusedCourseIds,
  }: NativeArchiveImport) {
    await this.activityLogsService.recordActivity({
      actor,
      tenantId: actor.tenantId,
      operation: ACTIVITY_LOG_ACTION_TYPES.IMPORT,
      resourceType: this.getArchiveResourceType(kind),
      resourceId: rootId,
      context: {
        importMode,
        ...(importSourceKind && { importSourceKind }),
        ...(alreadyExists && { alreadyExists: String(alreadyExists) }),
        ...(kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH &&
          createdCourseIds.length > 0 && { createdCourseIds: JSON.stringify(createdCourseIds) }),
        ...(reusedCourseIds.length > 0 && { reusedCourseIds: JSON.stringify(reusedCourseIds) }),
      },
    });
  }

  private getArchiveResourceType(kind: NativeArchiveKind) {
    return match(kind)
      .with(NATIVE_ARCHIVE_KIND.COURSE, () => ACTIVITY_LOG_RESOURCE_TYPES.COURSE)
      .with(NATIVE_ARCHIVE_KIND.LEARNING_PATH, () => ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH)
      .exhaustive();
  }
}
