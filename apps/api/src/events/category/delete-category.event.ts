import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteCategoryData = {
  categoryId: UUIDType;
  actor: ActorUserType;
  categoryTitle?: string | null;
};

export class DeleteCategoryEvent {
  constructor(public readonly deleteCategoryData: DeleteCategoryData) {}
}
