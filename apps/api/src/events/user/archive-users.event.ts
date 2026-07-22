import type { UUIDType } from "src/common";

export class ArchiveUsersEvent {
  constructor(public readonly userIds: UUIDType[]) {}
}
