import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteGroupData = {
  groupId: UUIDType;
  actor: CurrentUser;
  groupName?: string | null;
};

export class DeleteGroupEvent {
  constructor(public readonly deleteGroupData: DeleteGroupData) {}
}
