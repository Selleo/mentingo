import { forwardRef, Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { GroupController } from "src/group/group.controller";
import { GroupService } from "src/group/group.service";
import { PermissionsModule } from "src/permissions/permissions.module";

@Module({
  imports: [forwardRef(() => CourseModule), PermissionsModule],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
