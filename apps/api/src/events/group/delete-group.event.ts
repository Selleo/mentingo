import type { UUIDType } from "src/common";

type DeleteGroupData = {
  groupId: UUIDType;
  deletedById: UUIDType;
  groupName?: string | null;
};

export class DeleteGroupEvent {
  constructor(public readonly deleteGroupData: DeleteGroupData) {}
}
