import { Module, forwardRef } from "@nestjs/common";

import { CategoryModule } from "src/category/category.module";
import { ChapterModule } from "src/chapter/chapter.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { IngestionModule } from "src/ingestion/ingestion.module";
import { LessonModule } from "src/lesson/lesson.module";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { QueueModule } from "src/queue";
import { QuizModule } from "src/quiz/quiz.module";
import { S3Module } from "src/s3/s3.module";
import { WebSocketModule } from "src/websocket";

import { CourseAuthoringApplicationRepository } from "./course-authoring-application.repository";
import { CourseAuthoringApplicationService } from "./course-authoring-application.service";
import { CourseAuthoringApplicationWorker } from "./course-authoring-application.worker";
import { CourseAuthoringApplyService } from "./course-authoring-apply.service";
import { CourseAuthoringAutonomousFailureService } from "./course-authoring-autonomous-failure.service";
import { CourseAuthoringAutonomousWorker } from "./course-authoring-autonomous.worker";
import { CourseAuthoringContextBridgeRepository } from "./course-authoring-context-bridge.repository";
import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextBridgeWorker } from "./course-authoring-context-bridge.worker";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
import { CourseAuthoringDraftApplyService } from "./course-authoring-draft-apply.service";
import { CourseAuthoringDraftContextService } from "./course-authoring-draft-context.service";
import { CourseAuthoringDraftLifecycleService } from "./course-authoring-draft-lifecycle.service";
import { CourseAuthoringDraftTransitionService } from "./course-authoring-draft-transition.service";
import { CourseAuthoringDraftController } from "./course-authoring-draft.controller";
import { CourseAuthoringDraftRepository } from "./course-authoring-draft.repository";
import { CourseAuthoringLinkPreviewController } from "./course-authoring-link-preview.controller";
import { CourseAuthoringLinkPreviewService } from "./course-authoring-link-preview.service";
import { CourseAuthoringReceiptService } from "./course-authoring-receipt.service";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { CourseAuthoringStagingCleanupService } from "./course-authoring-staging-cleanup.service";
import { CourseAuthoringController } from "./course-authoring.controller";
import { CourseAuthoringGateway } from "./course-authoring.gateway";
import { LumaService } from "./luma.service";

@Module({
  imports: [
    forwardRef(() => CourseModule),
    S3Module,
    QuizModule,
    PermissionsModule,
    ChapterModule,
    CategoryModule,
    FileModule,
    IngestionModule,
    LessonModule,
    LocalizationModule,
    WebSocketModule,
    QueueModule,
  ],
  providers: [
    CourseAuthoringApplyService,
    CourseAuthoringDraftApplyService,
    CourseAuthoringDraftContextService,
    CourseAuthoringDraftRepository,
    CourseAuthoringDraftLifecycleService,
    CourseAuthoringDraftTransitionService,
    CourseAuthoringApplicationService,
    CourseAuthoringApplicationWorker,
    CourseAuthoringAutonomousFailureService,
    CourseAuthoringAutonomousWorker,
    CourseAuthoringStagingCleanupService,
    CourseAuthoringReceiptService,
    CourseAuthoringGateway,
    CourseAuthoringContextService,
    CourseAuthoringContextBridgeRepository,
    CourseAuthoringContextBridgeService,
    CourseAuthoringContextBridgeWorker,
    CourseAuthoringApplicationRepository,
    CourseAuthoringSessionService,
    CourseAuthoringLinkPreviewService,
    LumaService,
  ],
  exports: [LumaService],
  controllers: [
    CourseAuthoringController,
    CourseAuthoringDraftController,
    CourseAuthoringLinkPreviewController,
  ],
})
export class LumaModule {}
