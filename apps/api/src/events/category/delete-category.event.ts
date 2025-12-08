import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteCategoryData = {
  categoryId: UUIDType;
  actor: CurrentUser;
  categoryTitle?: string | null;
};

export class DeleteCategoryEvent {
  constructor(public readonly deleteCategoryData: DeleteCategoryData) {}
}
