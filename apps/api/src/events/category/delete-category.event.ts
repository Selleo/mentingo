import type { UUIDType } from "src/common";

type DeleteCategoryData = {
  categoryId: UUIDType;
  deletedById: UUIDType;
  categoryTitle?: string | null;
};

export class DeleteCategoryEvent {
  constructor(public readonly deleteCategoryData: DeleteCategoryData) {}
}
