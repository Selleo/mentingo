import { forwardRef, Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { CourseChatModule } from "src/course-chat/course-chat.module";
import { CourseModule } from "src/courses/course.module";
import { UserModule } from "src/user/user.module";

import { AutomationLogsController } from "./automation-logs/automation-logs.controller";
import { AutomationDataResolverService } from "./automation-runner/automation-data-resolver.service";
import { AutomationRunnerService } from "./automation-runner/automation-runner.service";
import { AutomationTemplateService } from "./automation-runner/automation-template.service";
import { AutomationStepsController } from "./automations-steps/automations-steps.controller";
import { AutomationStepsService } from "./automations-steps/automations-steps.service";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationsHandler } from "./handlers/automations-handler";
import { AutomationLogsRepository } from "./repositories/automation-logs/automation-logs";
import { AutomationStepsRepository } from "./repositories/automation-steps/automation-steps.repository";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => CourseModule),
    forwardRef(() => AnnouncementsModule),
    forwardRef(() => CourseChatModule),
  ],
  providers: [
    AutomationsRepository,
    AutomationsService,
    AutomationStepsService,
    AutomationStepsRepository,
    AutomationsHandler,
    AutomationRunnerService,
    AutomationDataResolverService,
    AutomationTemplateService,
    AutomationLogsRepository,
  ],
  controllers: [AutomationsController, AutomationStepsController, AutomationLogsController],
  exports: [AutomationsService, AutomationRunnerService, AutomationStepsService],
})
export class AutomationsModule {}
