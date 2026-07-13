import { ActivityLogFactory } from "./activity-log.factory";
import { ArticleFactory } from "./article.factory";
import { CategoryFactory } from "./category.factory";
import { CertificateFactory } from "./certificate.factory";
import { CourseFactory } from "./course.factory";
import { CurriculumFactory } from "./curriculum.factory";
import { EnrollmentFactory } from "./enrollment.factory";
import { GroupFactory } from "./group.factory";
import { LearningPathEnrollmentFactory } from "./learning-path-enrollment.factory";
import { LearningPathFactory } from "./learning-path.factory";
import { LiveTrainingFactory } from "./live-training.factory";
import { NewsFactory } from "./news.factory";
import { QAFactory } from "./qa.factory";
import { TenantFactory } from "./tenant.factory";
import { UserFactory } from "./user.factory";

import type { FixtureApiClient } from "../utils/api-client";

export type FixtureFactories = {
  createActivityLogFactory: () => ActivityLogFactory;
  createArticleFactory: () => ArticleFactory;
  createCategoryFactory: () => CategoryFactory;
  createCertificateFactory: () => CertificateFactory;
  createCourseFactory: () => CourseFactory;
  createCurriculumFactory: () => CurriculumFactory;
  createEnrollmentFactory: () => EnrollmentFactory;
  createGroupFactory: () => GroupFactory;
  createLearningPathFactory: () => LearningPathFactory;
  createLearningPathEnrollmentFactory: () => LearningPathEnrollmentFactory;
  createLiveTrainingFactory: () => LiveTrainingFactory;
  createNewsFactory: () => NewsFactory;
  createQAFactory: () => QAFactory;
  createTenantFactory: () => TenantFactory;
  createUserFactory: () => UserFactory;
};

export const createFixtureFactories = (apiClient: FixtureApiClient): FixtureFactories => {
  let activityLogFactory: ActivityLogFactory | undefined;
  let articleFactory: ArticleFactory | undefined;
  let categoryFactory: CategoryFactory | undefined;
  let certificateFactory: CertificateFactory | undefined;
  let courseFactory: CourseFactory | undefined;
  let curriculumFactory: CurriculumFactory | undefined;
  let enrollmentFactory: EnrollmentFactory | undefined;
  let groupFactory: GroupFactory | undefined;
  let learningPathFactory: LearningPathFactory | undefined;
  let learningPathEnrollmentFactory: LearningPathEnrollmentFactory | undefined;
  let liveTrainingFactory: LiveTrainingFactory | undefined;
  let newsFactory: NewsFactory | undefined;
  let qaFactory: QAFactory | undefined;
  let tenantFactory: TenantFactory | undefined;
  let userFactory: UserFactory | undefined;

  return {
    createActivityLogFactory: () => {
      activityLogFactory ??= new ActivityLogFactory(apiClient);
      return activityLogFactory;
    },
    createArticleFactory: () => {
      articleFactory ??= new ArticleFactory(apiClient);
      return articleFactory;
    },
    createCategoryFactory: () => {
      categoryFactory ??= new CategoryFactory(apiClient);
      return categoryFactory;
    },
    createCertificateFactory: () => {
      certificateFactory ??= new CertificateFactory(apiClient);
      return certificateFactory;
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
    createLearningPathFactory: () => {
      learningPathFactory ??= new LearningPathFactory(apiClient);
      return learningPathFactory;
    },
    createLearningPathEnrollmentFactory: () => {
      learningPathEnrollmentFactory ??= new LearningPathEnrollmentFactory(apiClient);
      return learningPathEnrollmentFactory;
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

export { ActivityLogFactory } from "./activity-log.factory";
export { ArticleFactory } from "./article.factory";
export { CategoryFactory } from "./category.factory";
export { CertificateFactory } from "./certificate.factory";
export { CourseFactory } from "./course.factory";
export { CurriculumFactory } from "./curriculum.factory";
export { EnrollmentFactory } from "./enrollment.factory";
export { GroupFactory } from "./group.factory";
export { LearningPathEnrollmentFactory } from "./learning-path-enrollment.factory";
export { LearningPathFactory } from "./learning-path.factory";
export { NewsFactory } from "./news.factory";
export { QAFactory } from "./qa.factory";
export { TenantFactory } from "./tenant.factory";
export { UserFactory } from "./user.factory";
