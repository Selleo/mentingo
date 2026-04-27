import { ArticleFactory } from "./article.factory";
import { CategoryFactory } from "./category.factory";
import { CourseFactory } from "./course.factory";
import { CurriculumFactory } from "./curriculum.factory";
import { EnrollmentFactory } from "./enrollment.factory";
import { GroupFactory } from "./group.factory";
import { NewsFactory } from "./news.factory";
import { TenantFactory } from "./tenant.factory";
import { UserFactory } from "./user.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createArticleFactory: () => ArticleFactory;
  createCategoryFactory: () => CategoryFactory;
  createCourseFactory: () => CourseFactory;
  createCurriculumFactory: () => CurriculumFactory;
  createEnrollmentFactory: () => EnrollmentFactory;
  createGroupFactory: () => GroupFactory;
  createNewsFactory: () => NewsFactory;
  createTenantFactory: () => TenantFactory;
  createUserFactory: () => UserFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let articleFactory: ArticleFactory | undefined;
  let categoryFactory: CategoryFactory | undefined;
  let courseFactory: CourseFactory | undefined;
  let curriculumFactory: CurriculumFactory | undefined;
  let enrollmentFactory: EnrollmentFactory | undefined;
  let groupFactory: GroupFactory | undefined;
  let newsFactory: NewsFactory | undefined;
  let tenantFactory: TenantFactory | undefined;
  let userFactory: UserFactory | undefined;

  return {
    createArticleFactory: () => {
      articleFactory ??= new ArticleFactory(apiClient);
      return articleFactory;
    },
    createCategoryFactory: () => {
      categoryFactory ??= new CategoryFactory(apiClient);
      return categoryFactory;
    },
    createCourseFactory: () => {
      courseFactory ??= new CourseFactory(apiClient);
      return courseFactory;
    },
    createCurriculumFactory: () => {
      curriculumFactory ??= new CurriculumFactory(apiClient);
      return curriculumFactory;
    },
    createEnrollmentFactory: () => {
      enrollmentFactory ??= new EnrollmentFactory(apiClient);
      return enrollmentFactory;
    },
    createGroupFactory: () => {
      groupFactory ??= new GroupFactory(apiClient);
      return groupFactory;
    },
    createNewsFactory: () => {
      newsFactory ??= new NewsFactory(apiClient);
      return newsFactory;
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

export { ArticleFactory } from "./article.factory";
export { CategoryFactory } from "./category.factory";
export { CourseFactory } from "./course.factory";
export { CurriculumFactory } from "./curriculum.factory";
export { EnrollmentFactory } from "./enrollment.factory";
export { GroupFactory } from "./group.factory";
export { NewsFactory } from "./news.factory";
export { TenantFactory } from "./tenant.factory";
export { UserFactory } from "./user.factory";
