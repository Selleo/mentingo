import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type {
  NativeArchiveImportMode,
  NativeArchiveKind,
} from "src/native-archive/native-archive.types";

export type NativeArchiveImport = {
  actor: ActorUserType;
  kind: NativeArchiveKind;
  rootId: UUIDType;
  importMode: NativeArchiveImportMode;
  importSourceKind: string | null;
  alreadyExists: boolean;
  createdCourseIds: UUIDType[];
  reusedCourseIds: UUIDType[];
};

export class NativeArchiveImportedEvent {
  constructor(public readonly archiveImport: NativeArchiveImport) {}
}
