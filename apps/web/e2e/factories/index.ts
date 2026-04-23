import { CategoryFactory } from "./category.factory";
import { CourseFactory } from "./course.factory";
import { GroupFactory } from "./group.factory";
import { TenantFactory } from "./tenant.factory";
import { UserFactory } from "./user.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createCategoryFactory: () => CategoryFactory;
  createCourseFactory: () => CourseFactory;
  createGroupFactory: () => GroupFactory;
  createTenantFactory: () => TenantFactory;
  createUserFactory: () => UserFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let categoryFactory: CategoryFactory | undefined;
  let courseFactory: CourseFactory | undefined;
  let groupFactory: GroupFactory | undefined;
  let tenantFactory: TenantFactory | undefined;
  let userFactory: UserFactory | undefined;

  return {
    createCategoryFactory: () => {
      categoryFactory ??= new CategoryFactory(apiClient);
      return categoryFactory;
    },
    createCourseFactory: () => {
      courseFactory ??= new CourseFactory(apiClient);
      return courseFactory;
    },
    createGroupFactory: () => {
      groupFactory ??= new GroupFactory(apiClient);
      return groupFactory;
    },
    createTenantFactory: () => {
      tenantFactory ??= new TenantFactory(apiClient);
      return tenantFactory;
    },
    createUserFactory: () => {
      userFactory ??= new UserFactory(apiClient);
      return userFactory;
    },
  };
};

export { CategoryFactory } from "./category.factory";
export { CourseFactory } from "./course.factory";
export { GroupFactory } from "./group.factory";
export { TenantFactory } from "./tenant.factory";
export { UserFactory } from "./user.factory";
