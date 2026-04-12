import { CategoryFactory } from "./category.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createCategoryFactory: () => CategoryFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let categoryFactory: CategoryFactory | undefined;

  return {
    createCategoryFactory: () => {
      categoryFactory ??= new CategoryFactory(apiClient);
      return categoryFactory;
    },
  };
};

export { CategoryFactory } from "./category.factory";
