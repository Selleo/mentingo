import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ActivityLogsService } from "./activity-logs.service";
import { AnnouncementActivityHandler } from "./handlers/announcement-activity.handler";
import { AuthActivityHandler } from "./handlers/auth-activity.handler";
import { CategoryActivityHandler } from "./handlers/category-activity.handler";
import { ChapterActivityHandler } from "./handlers/chapter-activity.handler";
import { CourseActivityHandler } from "./handlers/course-activity.handler";
import { EnvActivityHandler } from "./handlers/env-activity.handler";
import { GroupActivityHandler } from "./handlers/group-activity.handler";
import { LessonActivityHandler } from "./handlers/lesson-activity.handler";
import { SettingsActivityHandler } from "./handlers/settings-activity.handler";
import { UserActivityHandler } from "./handlers/user-activity.handler";

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    ActivityLogsService,
    ChapterActivityHandler,
    LessonActivityHandler,
    CourseActivityHandler,
    AnnouncementActivityHandler,
    GroupActivityHandler,
    CategoryActivityHandler,
    SettingsActivityHandler,
    UserActivityHandler,
    EnvActivityHandler,
    AuthActivityHandler,
  ],
  exports: [ActivityLogsService, CqrsModule],
})
export class ActivityLogsModule {}
