import type { UUIDType } from "src/common";

type GroupCourseDueDatesSyncedData = {
  courseId: UUIDType;
  groupIds: UUIDType[];
};

export class GroupCourseDueDatesSyncedEvent {
  constructor(public readonly groupCourseDueDatesSyncedData: GroupCourseDueDatesSyncedData) {}
}
