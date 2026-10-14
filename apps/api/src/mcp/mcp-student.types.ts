import type { ArticlesService } from "src/articles/services/articles.service";
import type { CourseService } from "src/courses/course.service";
import type { NewsService } from "src/news/news.service";
import type { QAService } from "src/qa/services/qa.service";
import type { FEATURES } from "@repo/shared";

export type McpStudentFeature =
  | typeof FEATURES.ARTICLES
  | typeof FEATURES.NEWS
  | typeof FEATURES.QA;

export type McpStudentServices = {
  courses: CourseService;
  articles: ArticlesService;
  news: NewsService;
  qa: QAService;
  assertFeatureEnabled: (feature: McpStudentFeature) => Promise<void>;
};

export type McpStudentCourseMetadata = {
  id: string;
  title: string;
  description: string;
  category: string;
  enrolled?: boolean;
  courseChapterCount: number;
  priceInCents: number;
  currency: string;
};

export type McpStudentPageQuery = { page?: number; pageSize?: number; query?: string };
