import { PERMISSIONS, type PermissionKey } from "@repo/shared";

import { ArticlesController } from "src/articles/articles.controller";
import { CategoryController } from "src/category/category.controller";
import { ChapterController } from "src/chapter/chapter.controller";
import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { CourseController } from "src/courses/course.controller";
import { LearningPathController } from "src/learning-path/controllers/learning-path.controller";
import { NewsController } from "src/news/news.controller";

const TOOL_REST_PERMISSION_PAIRS: Array<{
  tool: string;
  restHandler: (...args: never[]) => unknown;
  mcpPermissions: PermissionKey[];
}> = [
  {
    tool: "update_course",
    restHandler: CourseController.prototype.updateCourse,
    mcpPermissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  },
  {
    tool: "delete_course",
    restHandler: CourseController.prototype.deleteCourse,
    mcpPermissions: [PERMISSIONS.COURSE_DELETE],
  },
  {
    tool: "update_category",
    restHandler: CategoryController.prototype.updateCategory,
    mcpPermissions: [PERMISSIONS.CATEGORY_MANAGE],
  },
  {
    tool: "delete_category",
    restHandler: CategoryController.prototype.deleteCategory,
    mcpPermissions: [PERMISSIONS.CATEGORY_MANAGE],
  },
  {
    tool: "update_chapter",
    restHandler: ChapterController.prototype.updateChapter,
    mcpPermissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  },
  {
    tool: "delete_chapter",
    restHandler: ChapterController.prototype.removeChapter,
    mcpPermissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  },
  {
    tool: "update_article",
    restHandler: ArticlesController.prototype.updateArticle,
    mcpPermissions: [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
  },
  {
    tool: "delete_article",
    restHandler: ArticlesController.prototype.deleteArticle,
    mcpPermissions: [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
  },
  {
    tool: "update_news",
    restHandler: NewsController.prototype.updateNews,
    mcpPermissions: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN],
  },
  {
    tool: "delete_news",
    restHandler: NewsController.prototype.deleteNews,
    mcpPermissions: [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN],
  },
  {
    tool: "update_development_path",
    restHandler: LearningPathController.prototype.updateLearningPath,
    mcpPermissions: [PERMISSIONS.LEARNING_PATH_UPDATE, PERMISSIONS.LEARNING_PATH_UPDATE_OWN],
  },
  {
    tool: "delete_development_path",
    restHandler: LearningPathController.prototype.deleteLearningPath,
    mcpPermissions: [PERMISSIONS.LEARNING_PATH_DELETE],
  },
];

describe("MCP tool / REST endpoint permission parity", () => {
  it.each(TOOL_REST_PERMISSION_PAIRS)(
    "$tool requires the same permissions as its REST endpoint",
    ({ restHandler, mcpPermissions }) => {
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, restHandler)).toEqual(mcpPermissions);
    },
  );
});
