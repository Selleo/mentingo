import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type EnrollUserToGroupData = {
  groupId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class EnrollUserToGroupEvent {
  constructor(public readonly enrollmentData: EnrollUserToGroupData) {}
}
