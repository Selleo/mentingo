import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CategoryUpdateData = {
  categoryId: UUIDType;
  actor: ActorUserType;
  previousCategoryData: CategoryActivityLogSnapshot | null;
  updatedCategoryData: CategoryActivityLogSnapshot | null;
};

export class UpdateCategoryEvent {
  constructor(public readonly categoryUpdateData: CategoryUpdateData) {}
}
