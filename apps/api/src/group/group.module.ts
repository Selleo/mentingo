import { forwardRef, Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { GroupController } from "src/group/group.controller";
import { GroupService } from "src/group/group.service";

@Module({
  imports: [forwardRef(() => CourseModule)],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
