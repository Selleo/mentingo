import type { UUIDType } from "src/common";

type UsersAssignedToCourse = {
  studentIds: UUIDType[];
  courseId: UUIDType;
  tenantId: UUIDType;
};

export class UsersAssignedToCourseEvent {
  constructor(public readonly usersAssignedToCourse: UsersAssignedToCourse) {}
}
