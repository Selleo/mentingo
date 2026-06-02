import type { UUIDType } from "src/common";

export type RemovedGroupCourseDueDate = {
  groupId: UUIDType;
  calendarEventId: UUIDType | null;
};

type GroupCourseDueDatesRemovedData = {
  courseId: UUIDType;
  groups: RemovedGroupCourseDueDate[];
};

export class GroupCourseDueDatesRemovedEvent {
  constructor(public readonly groupCourseDueDatesRemovedData: GroupCourseDueDatesRemovedData) {}
}
