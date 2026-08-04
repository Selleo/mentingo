import { ArticleFactory } from "./article.factory";
import { AutomationFactory } from "./automation.factory";
import { CategoryFactory } from "./category.factory";
import { CourseFactory } from "./course.factory";
import { CurriculumFactory } from "./curriculum.factory";
import { EmailTemplateFactory } from "./email-template.factory";
import { EnrollmentFactory } from "./enrollment.factory";
import { GroupFactory } from "./group.factory";
import { LiveTrainingFactory } from "./live-training.factory";
import { NewsFactory } from "./news.factory";
import { QAFactory } from "./qa.factory";
import { TenantFactory } from "./tenant.factory";
import { UserFactory } from "./user.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createArticleFactory: () => ArticleFactory;
  createAutomationFactory: () => AutomationFactory;
  createCategoryFactory: () => CategoryFactory;
  createCourseFactory: () => CourseFactory;
  createCurriculumFactory: () => CurriculumFactory;
  createEnrollmentFactory: () => EnrollmentFactory;
  createEmailTemplateFactory: () => EmailTemplateFactory;
  createGroupFactory: () => GroupFactory;
  createLiveTrainingFactory: () => LiveTrainingFactory;
  createNewsFactory: () => NewsFactory;
  createQAFactory: () => QAFactory;
  createTenantFactory: () => TenantFactory;
  createUserFactory: () => UserFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let articleFactory: ArticleFactory | undefined;
  let automationFactory: AutomationFactory | undefined;
  let categoryFactory: CategoryFactory | undefined;
  let courseFactory: CourseFactory | undefined;
  let curriculumFactory: CurriculumFactory | undefined;
  let enrollmentFactory: EnrollmentFactory | undefined;
  let emailTemplateFactory: EmailTemplateFactory | undefined;
  let groupFactory: GroupFactory | undefined;
  let liveTrainingFactory: LiveTrainingFactory | undefined;
  let newsFactory: NewsFactory | undefined;
  let qaFactory: QAFactory | undefined;
  let tenantFactory: TenantFactory | undefined;
  let userFactory: UserFactory | undefined;

  return {
    createArticleFactory: () => {
      articleFactory ??= new ArticleFactory(apiClient);
      return articleFactory;
    },
    createAutomationFactory: () => {
      automationFactory ??= new AutomationFactory(apiClient);
      return automationFactory;
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
    createEmailTemplateFactory: () => {
      emailTemplateFactory ??= new EmailTemplateFactory(apiClient);
      return emailTemplateFactory;
    },
    createGroupFactory: () => {
      groupFactory ??= new GroupFactory(apiClient);
      return groupFactory;
    },
    createLiveTrainingFactory: () => {
      liveTrainingFactory ??= new LiveTrainingFactory(apiClient);
      return liveTrainingFactory;
    },
    createNewsFactory: () => {
      newsFactory ??= new NewsFactory(apiClient);
      return newsFactory;
    },
    createQAFactory: () => {
      qaFactory ??= new QAFactory(apiClient);
      return qaFactory;
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
export { AutomationFactory } from "./automation.factory";
export { CategoryFactory } from "./category.factory";
export { CourseFactory } from "./course.factory";
export { CurriculumFactory } from "./curriculum.factory";
export { EnrollmentFactory } from "./enrollment.factory";
export { EmailTemplateFactory } from "./email-template.factory";
export { GroupFactory } from "./group.factory";
export { NewsFactory } from "./news.factory";
export { QAFactory } from "./qa.factory";
export { TenantFactory } from "./tenant.factory";
export { UserFactory } from "./user.factory";
