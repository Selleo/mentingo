import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type EnrollUserToGroupData = {
  groupId: UUIDType;
  userId: UUIDType;
  actor: CurrentUser;
};

export class EnrollUserToGroupEvent {
  constructor(public readonly enrollmentData: EnrollUserToGroupData) {}
}
