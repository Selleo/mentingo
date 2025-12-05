import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CategoryUpdateData = {
  categoryId: UUIDType;
  updatedById: UUIDType;
  previousCategoryData: CategoryActivityLogSnapshot | null;
  updatedCategoryData: CategoryActivityLogSnapshot | null;
};

export class UpdateCategoryEvent {
  constructor(public readonly categoryUpdateData: CategoryUpdateData) {}
}
