import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type BulkUpdateCourseStatusItem = {
  courseId: UUIDType;
  previousCourseData: CourseActivityLogSnapshot | null;
  updatedCourseData: CourseActivityLogSnapshot | null;
};

type BulkUpdateCourseStatusData = {
  actor: ActorUserType;
  tenantId: UUIDType;
  status: string;
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  updates: BulkUpdateCourseStatusItem[];
};

export class BulkUpdateCourseStatusEvent {
  constructor(public readonly bulkUpdateCourseStatusData: BulkUpdateCourseStatusData) {}
}
