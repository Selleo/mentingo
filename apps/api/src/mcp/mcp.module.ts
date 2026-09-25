import { Module } from "@nestjs/common";

import { ArticlesModule } from "src/articles/articles.module";
import { CategoryModule } from "src/category/category.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { LearningPathModule } from "src/learning-path/learning-path.module";
import { LessonModule } from "src/lesson/lesson.module";
import { NewsModule } from "src/news/news.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QAModule } from "src/qa/qa.module";
import { RedisClientsModule } from "src/redis";
import { ResourceLibraryModule } from "src/resource-library/resource-library.module";
import { ScormModule } from "src/scorm/scorm.module";
import { SettingsModule } from "src/settings/settings.module";

import { McpAuthGuard } from "./mcp-auth.guard";
import { McpHttpService } from "./mcp-http.service";
import { McpOAuthController } from "./mcp-oauth.controller";
import { McpOAuthService } from "./mcp-oauth.service";
import { McpResourceService } from "./mcp-resource.service";
import { McpTokenService } from "./mcp-token.service";
import { McpUploadGrantService } from "./mcp-upload-grant.service";
import { McpController } from "./mcp.controller";

@Module({
  imports: [
    CourseModule,
    FileModule,
    ChapterModule,
    CategoryModule,
    LessonModule,
    LearningPathModule,
    ArticlesModule,
    NewsModule,
    QAModule,
    ResourceLibraryModule,
    ScormModule,
    PermissionsModule,
    RedisClientsModule,
    SettingsModule,
  ],
  providers: [
    McpHttpService,
    McpAuthGuard,
    McpTokenService,
    McpUploadGrantService,
    McpOAuthService,
    McpResourceService,
  ],
  controllers: [McpOAuthController, McpController],
  exports: [
    McpHttpService,
    McpTokenService,
    McpUploadGrantService,
    McpOAuthService,
    McpResourceService,
  ],
})
export class McpModule {}
