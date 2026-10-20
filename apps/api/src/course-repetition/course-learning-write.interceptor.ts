import {
  applyDecorators,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UseInterceptors,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiHeader } from "@nestjs/swagger";
import { COURSE_LEARNING_STATE_HEADER } from "@repo/shared";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { defer, lastValueFrom } from "rxjs";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import {
  aiMentorLessons,
  aiMentorThreads,
  chapters,
  lessons,
  scormAttempts,
} from "src/storage/schema";

import { courseLearningContext } from "./course-learning-context";
import { COURSE_LEARNING_TARGET_ENTITIES } from "./course-learning-write.constants";
import { CourseRepetitionService } from "./course-repetition.service";

import type { CourseLearningTarget } from "./course-learning-write.types";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";

const LEARNING_TARGET = "courseLearningTarget";

export const CourseLearningWrite = (target: CourseLearningTarget) =>
  applyDecorators(
    SetMetadata(LEARNING_TARGET, target),
    ApiHeader({
      name: COURSE_LEARNING_STATE_HEADER,
      required: false,
      schema: { type: "string", format: "uuid" },
    }),
    UseInterceptors(CourseLearningWriteInterceptor),
  );

@Injectable()
export class CourseLearningWriteInterceptor implements NestInterceptor {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly reflector: Reflector,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly courseRepetitionService: CourseRepetitionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const target = this.reflector.get<CourseLearningTarget>(LEARNING_TARGET, context.getHandler());
    const request = context.switchToHttp().getRequest();
    const entityId = request[target.source]?.[target.field];
    const userId = request.user?.userId;
    if (!entityId || !userId) return next.handle();
    if (
      typeof entityId !== "string" ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(entityId)
    )
      throw new BadRequestException("common.toast.invalidRequest");
    const execute = async () => {
      let lessonCondition = eq(lessons.id, entityId);
      if (target.entity === COURSE_LEARNING_TARGET_ENTITIES.THREAD)
        lessonCondition = inArray(
          lessons.id,
          this.db
            .select({ lessonId: aiMentorLessons.lessonId })
            .from(aiMentorThreads)
            .innerJoin(aiMentorLessons, eq(aiMentorLessons.id, aiMentorThreads.aiMentorLessonId))
            .where(and(eq(aiMentorThreads.id, entityId), eq(aiMentorThreads.userId, userId))),
        );
      if (target.entity === COURSE_LEARNING_TARGET_ENTITIES.SCORM)
        lessonCondition = inArray(
          lessons.id,
          this.db
            .select({ lessonId: scormAttempts.lessonId })
            .from(scormAttempts)
            .where(and(eq(scormAttempts.id, entityId), eq(scormAttempts.studentId, userId))),
        );
      const [course] = await this.db
        .select({ courseId: chapters.courseId })
        .from(chapters)
        .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
        .where(lessonCondition);
      if (!course && target.entity === COURSE_LEARNING_TARGET_ENTITIES.THREAD) {
        const [practice] = await this.db
          .select({ id: aiMentorThreads.id })
          .from(aiMentorThreads)
          .where(
            and(
              eq(aiMentorThreads.id, entityId),
              eq(aiMentorThreads.userId, userId),
              isNotNull(aiMentorThreads.practiceSessionId),
            ),
          );
        if (practice) return lastValueFrom(next.handle());
      }
      if (!course) throw new ConflictException("courseRepetition.errors.staleState");
      await this.courseRepetitionService.lock(course.courseId, userId, this.db);
      const supplied = request.headers[COURSE_LEARNING_STATE_HEADER];
      const learningStateId = await this.courseRepetitionService.resolveWritableState(
        course.courseId,
        userId,
        supplied,
      );
      if (
        target.entity === COURSE_LEARNING_TARGET_ENTITIES.THREAD ||
        target.entity === COURSE_LEARNING_TARGET_ENTITIES.SCORM
      ) {
        const table =
          target.entity === COURSE_LEARNING_TARGET_ENTITIES.THREAD
            ? aiMentorThreads
            : scormAttempts;
        const [entity] = await this.db
          .select({ learningStateId: table.learningStateId })
          .from(table)
          .where(eq(table.id, entityId));
        if (!entity || entity.learningStateId !== learningStateId)
          throw new ConflictException("courseRepetition.errors.staleState");
      }
      return courseLearningContext.run({ learningStateId }, () => lastValueFrom(next.handle()));
    };
    return defer(() =>
      target.transactional === false ? execute() : this.tenantDbRunnerService.transaction(execute),
    );
  }
}
