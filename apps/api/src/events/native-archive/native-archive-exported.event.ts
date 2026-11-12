import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type {
  NativeArchiveExportAccess,
  NativeArchiveKind,
} from "src/native-archive/native-archive.types";

export type NativeArchiveExport = {
  actor: ActorUserType;
  kind: NativeArchiveKind;
  rootId: UUIDType;
  exportAccess: NativeArchiveExportAccess;
};

export class NativeArchiveExportedEvent {
  constructor(public readonly archiveExport: NativeArchiveExport) {}
}
