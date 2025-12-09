import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CategoryUpdateData = {
  categoryId: UUIDType;
  actor: CurrentUser;
  previousCategoryData: CategoryActivityLogSnapshot | null;
  updatedCategoryData: CategoryActivityLogSnapshot | null;
};

export class UpdateCategoryEvent {
  constructor(public readonly categoryUpdateData: CategoryUpdateData) {}
}
