import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { ActivityLogsService } from "./activity-logs.service";
import { AnnouncementActivityHandler } from "./handlers/announcement-activity.handler";
import { ChapterActivityHandler } from "./handlers/chapter-activity.handler";
import { CourseActivityHandler } from "./handlers/course-activity.handler";
import { GroupActivityHandler } from "./handlers/group-activity.handler";
import { LessonActivityHandler } from "./handlers/lesson-activity.handler";

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
  ],
  exports: [ActivityLogsService, CqrsModule],
})
export class ActivityLogsModule {}
