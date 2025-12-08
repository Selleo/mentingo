import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CategoryCreationData = {
  categoryId: UUIDType;
  actor: CurrentUser;
  category: CategoryActivityLogSnapshot;
};

export class CreateCategoryEvent {
  constructor(public readonly categoryData: CategoryCreationData) {}
}
