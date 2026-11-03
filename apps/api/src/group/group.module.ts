import { forwardRef, Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { GroupController } from "src/group/group.controller";
import { GroupService } from "src/group/group.service";
import { GroupMembershipEnrollmentHandler } from "src/group/handlers/group-membership-enrollment.handler";
import { GroupMembershipAssignmentRepository } from "src/group/repositories/group-membership-assignment.repository";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";

@Module({
  imports: [forwardRef(() => CourseModule), LocalizationModule, PermissionsModule],
  controllers: [GroupController],
  providers: [GroupService, GroupMembershipEnrollmentHandler, GroupMembershipAssignmentRepository],
  exports: [GroupService],
})
export class GroupModule {}
