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
import { sql } from "drizzle-orm";
import { defer, lastValueFrom } from "rxjs";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { courseLearningContext } from "./course-learning-context";
import { CourseRepetitionService } from "./course-repetition.service";

import type { CourseLearningTarget } from "./course-learning-write.types";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";

const LEARNING_TARGET = "courseLearningTarget";

export const CourseLearningWrite = (target: CourseLearningTarget) =>
  applyDecorators(
    SetMetadata(LEARNING_TARGET, target),
    ApiHeader({
      name: "x-course-learning-state-id",
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
      let lessonId = sql`${entityId}::uuid`;
      if (target.entity === "thread")
        lessonId = sql`(SELECT a.lesson_id FROM ai_mentor_threads t JOIN ai_mentor_lessons a ON a.id = t.ai_mentor_lesson_id WHERE t.id = ${entityId} AND t.user_id = ${userId})`;
      if (target.entity === "scorm")
        lessonId = sql`(SELECT lesson_id FROM scorm_attempts WHERE id = ${entityId} AND student_id = ${userId})`;
      const [course] = await this.db.execute<{ course_id: string }>(
        sql`SELECT ch.course_id FROM chapters ch JOIN lessons l ON l.chapter_id = ch.id WHERE l.id = ${lessonId}`,
      );
      if (!course && target.entity === "thread") {
        const [practice] = await this.db.execute(
          sql`SELECT id FROM ai_mentor_threads WHERE id = ${entityId} AND user_id = ${userId} AND practice_session_id IS NOT NULL`,
        );
        if (practice) return lastValueFrom(next.handle());
      }
      if (!course) throw new ConflictException("courseRepetition.errors.staleState");
      await this.courseRepetitionService.lock(course.course_id, userId, this.db);
      const supplied = request.headers["x-course-learning-state-id"];
      const learningStateId = await this.courseRepetitionService.resolveWritableState(
        course.course_id,
        userId,
        supplied,
      );
      if (target.entity === "thread" || target.entity === "scorm") {
        const table = target.entity === "thread" ? sql`ai_mentor_threads` : sql`scorm_attempts`;
        const [entity] = await this.db.execute<{ learning_state_id: string | null }>(
          sql`SELECT learning_state_id FROM ${table} WHERE id = ${entityId}`,
        );
        if (!entity || entity.learning_state_id !== learningStateId)
          throw new ConflictException("courseRepetition.errors.staleState");
      }
      return courseLearningContext.run({ learningStateId }, () => lastValueFrom(next.handle()));
    };
    return defer(() =>
      target.transactional === false ? execute() : this.tenantDbRunnerService.transaction(execute),
    );
  }
}
