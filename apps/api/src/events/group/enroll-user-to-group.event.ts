import type { UUIDType } from "src/common";

type EnrollUserToGroupData = {
  groupId: UUIDType;
  userId: UUIDType;
  enrolledById: UUIDType;
};

export class EnrollUserToGroupEvent {
  constructor(public readonly enrollmentData: EnrollUserToGroupData) {}
}
