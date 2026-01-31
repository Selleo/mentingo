import type { CategoryActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CategoryCreationData = {
  categoryId: UUIDType;
  actor: ActorUserType;
  category: CategoryActivityLogSnapshot;
};

export class CreateCategoryEvent {
  constructor(public readonly categoryData: CategoryCreationData) {}
}
