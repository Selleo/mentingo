import { CategoryFactory } from "./category.factory";
import { GroupFactory } from "./group.factory";
import { UserFactory } from "./user.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createCategoryFactory: () => CategoryFactory;
  createGroupFactory: () => GroupFactory;
  createUserFactory: () => UserFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let categoryFactory: CategoryFactory | undefined;
  let groupFactory: GroupFactory | undefined;
  let userFactory: UserFactory | undefined;

  return {
    createCategoryFactory: () => {
      categoryFactory ??= new CategoryFactory(apiClient);
      return categoryFactory;
    },
    createGroupFactory: () => {
      groupFactory ??= new GroupFactory(apiClient);
      return groupFactory;
    },
    createUserFactory: () => {
      userFactory ??= new UserFactory(apiClient);
      return userFactory;
    },
  };
};

export { CategoryFactory } from "./category.factory";
export { GroupFactory } from "./group.factory";
export { UserFactory } from "./user.factory";
