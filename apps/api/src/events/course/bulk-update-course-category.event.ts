import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type BulkUpdateCourseCategoryItem = {
  courseId: UUIDType;
  previousCourseData: CourseActivityLogSnapshot | null;
  updatedCourseData: CourseActivityLogSnapshot | null;
};

type BulkUpdateCourseCategoryData = {
  actor: ActorUserType;
  tenantId: UUIDType;
  categoryId: UUIDType;
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  updates: BulkUpdateCourseCategoryItem[];
};

export class BulkUpdateCourseCategoryEvent {
  constructor(public readonly bulkUpdateCourseCategoryData: BulkUpdateCourseCategoryData) {}
}
