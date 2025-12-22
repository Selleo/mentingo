import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CreateLessonEvent, DeleteLessonEvent } from "src/events";
import { WsGateway } from "src/websocket/websocket.gateway";

import { StudentLessonProgressService } from "../studentLessonProgress.service";

type LessonProgressEventType = DeleteLessonEvent | CreateLessonEvent;

@Injectable()
@EventsHandler(DeleteLessonEvent, CreateLessonEvent)
export class LessonDeletedProgressHandler implements IEventHandler<LessonProgressEventType> {
  private readonly logger = new Logger(LessonDeletedProgressHandler.name);

  constructor(
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly wsGateway: WsGateway,
  ) {}

  async handle(event: LessonProgressEventType) {
    if (event instanceof DeleteLessonEvent) {
      await this.handleLessonDeleted(event);
    } else if (event instanceof CreateLessonEvent) {
      await this.handleLessonCreated(event);
    }
  }

  private async handleLessonDeleted(event: DeleteLessonEvent) {
    const { deleteLessonData } = event;
    const { chapterId, courseId, actor } = deleteLessonData;

    this.logger.log(`Handling lesson deletion for chapter ${chapterId}, course ${courseId}`);

    try {
      // Recalculate progress for all enrolled students
      const affectedStudentIds =
        await this.studentLessonProgressService.recalculateProgressAfterLessonRemoval(
          chapterId,
          courseId,
          actor,
        );

      this.logger.log(`Found ${affectedStudentIds?.length ?? 0} enrolled students to notify`);

      // Notify affected students via WebSocket to refresh their course data
      if (affectedStudentIds && affectedStudentIds.length > 0) {
        for (const studentId of affectedStudentIds) {
          this.logger.debug(`Emitting course:updated to user ${studentId}`);
          this.wsGateway.emitToUser(studentId, "course:updated", {
            courseId,
            chapterId,
            type: "lesson_removed",
          });
        }
      }

      this.logger.log(
        `Recalculated progress for ${
          affectedStudentIds?.length ?? 0
        } students after lesson deletion`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate progress after lesson deletion: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async handleLessonCreated(event: CreateLessonEvent) {
    const { lessonCreationData } = event;
    const { chapterId, courseId } = lessonCreationData;

    this.logger.log(`Handling lesson creation for chapter ${chapterId}, course ${courseId}`);

    try {
      // Recalculate progress - if chapter was complete, it's now incomplete
      const affectedStudentIds =
        await this.studentLessonProgressService.recalculateProgressAfterLessonAdded(
          chapterId,
          courseId,
        );

      this.logger.log(`Found ${affectedStudentIds?.length ?? 0} enrolled students to notify`);

      // Notify affected students via WebSocket to refresh their course data
      if (affectedStudentIds && affectedStudentIds.length > 0) {
        for (const studentId of affectedStudentIds) {
          this.logger.debug(`Emitting course:updated to user ${studentId}`);
          this.wsGateway.emitToUser(studentId, "course:updated", {
            courseId,
            chapterId,
            type: "lesson_added",
          });
        }
      }

      this.logger.log(
        `Recalculated progress for ${
          affectedStudentIds?.length ?? 0
        } students after lesson creation`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate progress after lesson creation: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
