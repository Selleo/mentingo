import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CategoryCreationData = {
  categoryId: UUIDType;
  createdById: UUIDType;
  category: CategoryActivityLogSnapshot;
};

export class CreateCategoryEvent {
  constructor(public readonly categoryData: CategoryCreationData) {}
}
