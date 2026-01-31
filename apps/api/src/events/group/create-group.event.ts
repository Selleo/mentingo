import type { GroupActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CreateGroupData = {
  groupId: UUIDType;
  actor: ActorUserType;
  group: GroupActivityLogSnapshot;
};

export class CreateGroupEvent {
  constructor(public readonly groupData: CreateGroupData) {}
}
