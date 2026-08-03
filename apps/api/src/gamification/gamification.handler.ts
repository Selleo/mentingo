import { randomUUID } from "crypto";

import { Injectable, Logger } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";
import { hasPermission, PERMISSIONS } from "@repo/shared";
import { match } from "ts-pattern";

import {
  LessonCompletedEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";

import { GamificationQueueService } from "./gamification-queue.service";

import type { IEventHandler } from "@nestjs/cqrs";
import type { GamificationEventPayload } from "src/websocket";

type GamificationEventType =
  | LessonCompletedEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent
  | UserLoginEvent;

const GamificationEvents = [
  LessonCompletedEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
  UserLoginEvent,
] as const;

@Injectable()
@EventsHandler(...GamificationEvents)
export class GamificationHandler implements IEventHandler<GamificationEventType> {
  private readonly logger = new Logger(GamificationHandler.name);

  constructor(private readonly gamificationQueueService: GamificationQueueService) {}

  async handle(event: GamificationEventType) {
    try {
      const payload = match(event)
        .when(
          (e): e is UserLoginEvent => e instanceof UserLoginEvent,
          (e) => this.mapLoginEvent(e),
        )
        .when(
          (e): e is LessonCompletedEvent => e instanceof LessonCompletedEvent,
          (e) => this.mapLessonCompletedEvent(e),
        )
        .when(
          (e): e is UserChapterFinishedEvent => e instanceof UserChapterFinishedEvent,
          (e) => this.mapChapterFinishedEvent(e),
        )
        .when(
          (e): e is UserCourseFinishedEvent => e instanceof UserCourseFinishedEvent,
          (e) => this.mapCourseFinishedEvent(e),
        )
        .otherwise(() => null);

      if (!payload) return;

      this.logger.log(`Queueing gamification job for action: ${payload.actionType}`);
      await this.gamificationQueueService.enqueueEvent(payload);
    } catch (error) {
      this.logger.error("Error handling gamification event:", error);
    }
  }

  private mapLoginEvent(event: UserLoginEvent): GamificationEventPayload {
    const { userId, actor } = event.loginData;
    return {
      tenantId: actor.tenantId,
      userId,
      actorRole: actor.roleSlugs[0],
      actionType: "login",
      resourceType: "user",
      sourceId: randomUUID(),
      canViewHidden: hasPermission(actor.permissions, PERMISSIONS.ACHIEVEMENTS_VIEW_HIDDEN),
    };
  }

  private mapLessonCompletedEvent(event: LessonCompletedEvent): GamificationEventPayload {
    const { userId, lessonId, actor } = event.lessonCompletionData;
    return {
      tenantId: actor.tenantId,
      userId,
      actorRole: actor.roleSlugs[0],
      actionType: "complete_lesson",
      resourceType: "lesson",
      sourceId: lessonId,
      canViewHidden: hasPermission(actor.permissions, PERMISSIONS.ACHIEVEMENTS_VIEW_HIDDEN),
    };
  }

  private mapChapterFinishedEvent(event: UserChapterFinishedEvent): GamificationEventPayload {
    const { userId, chapterId, actor } = event.chapterFinishedData;
    return {
      tenantId: actor.tenantId,
      userId,
      actorRole: actor.roleSlugs[0],
      actionType: "complete_chapter",
      resourceType: "chapter",
      sourceId: chapterId,
      canViewHidden: hasPermission(actor.permissions, PERMISSIONS.ACHIEVEMENTS_VIEW_HIDDEN),
    };
  }

  private mapCourseFinishedEvent(event: UserCourseFinishedEvent): GamificationEventPayload {
    const { userId, courseId, actor } = event.courseFinishedData;
    return {
      tenantId: actor.tenantId,
      userId,
      actorRole: actor.roleSlugs[0],
      actionType: "complete_course",
      resourceType: "course",
      sourceId: courseId,
      canViewHidden: hasPermission(actor.permissions, PERMISSIONS.ACHIEVEMENTS_VIEW_HIDDEN),
    };
  }
}
