import { PERMISSIONS } from "@repo/shared";

import {
  UserLoginEvent,
  LessonCompletedEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
} from "src/events";

import { GamificationHandler } from "./gamification.handler";

import type { GamificationQueueService } from "./gamification-queue.service";
import type { PermissionKey } from "@repo/shared";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const LESSON_ID = "33333333-3333-3333-3333-333333333333";
const CHAPTER_ID = "44444444-4444-4444-4444-444444444444";
const COURSE_ID = "55555555-5555-5555-5555-555555555555";

const mockActor = {
  userId: USER_ID,
  email: "student@example.com",
  roleSlugs: ["student"],
  permissions: [],
  tenantId: TENANT_ID,
};

const createHandler = () => {
  const gamificationQueueService: jest.Mocked<Pick<GamificationQueueService, "enqueueEvent">> = {
    enqueueEvent: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new GamificationHandler(
    gamificationQueueService as unknown as GamificationQueueService,
  );

  return { handler, gamificationQueueService };
};

describe("GamificationHandler", () => {
  describe("handle UserLoginEvent", () => {
    it("enqueues a gamification job with actionType login", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new UserLoginEvent({ userId: USER_ID, method: "password", actor: mockActor });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          actorRole: "student",
          actionType: "login",
          resourceType: "user",
        }),
      );
    });

    it("generates a unique sourceId for each login event", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new UserLoginEvent({ userId: USER_ID, method: "password", actor: mockActor });

      await handler.handle(event);
      await handler.handle(event);

      const firstCall = gamificationQueueService.enqueueEvent.mock.calls[0][0];
      const secondCall = gamificationQueueService.enqueueEvent.mock.calls[1][0];
      expect(firstCall.sourceId).not.toBe(secondCall.sourceId);
    });
  });

  describe("handle LessonCompletedEvent", () => {
    it("enqueues a gamification job with actionType complete_lesson", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new LessonCompletedEvent({
        userId: USER_ID,
        lessonId: LESSON_ID,
        courseId: COURSE_ID,
        actor: mockActor,
      });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "complete_lesson",
          resourceType: "lesson",
          sourceId: LESSON_ID,
        }),
      );
    });
  });

  describe("handle UserChapterFinishedEvent", () => {
    it("enqueues a gamification job with actionType complete_chapter", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new UserChapterFinishedEvent({
        userId: USER_ID,
        chapterId: CHAPTER_ID,
        courseId: COURSE_ID,
        actor: mockActor,
      });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "complete_chapter",
          resourceType: "chapter",
          sourceId: CHAPTER_ID,
        }),
      );
    });
  });

  describe("handle UserCourseFinishedEvent", () => {
    it("enqueues a gamification job with actionType complete_course", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new UserCourseFinishedEvent({
        userId: USER_ID,
        courseId: COURSE_ID,
        actor: mockActor,
      });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "complete_course",
          resourceType: "course",
          sourceId: COURSE_ID,
        }),
      );
    });
  });

  describe("unknown event", () => {
    it("does not enqueue when event type is unrecognised", async () => {
      const { handler, gamificationQueueService } = createHandler();

      await handler.handle({ someRandomField: true } as any);

      expect(gamificationQueueService.enqueueEvent).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("does not throw when enqueueEvent fails", async () => {
      const { handler, gamificationQueueService } = createHandler();
      gamificationQueueService.enqueueEvent.mockRejectedValue(new Error("Redis down"));
      const event = new UserLoginEvent({ userId: USER_ID, method: "password", actor: mockActor });

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe("canViewHidden permission", () => {
    it("sets canViewHidden to false when actor has no ACHIEVEMENTS_VIEW_HIDDEN permission", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const event = new UserLoginEvent({ userId: USER_ID, method: "password", actor: mockActor });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({ canViewHidden: false }),
      );
    });

    it("sets canViewHidden to true when actor has ACHIEVEMENTS_VIEW_HIDDEN permission", async () => {
      const { handler, gamificationQueueService } = createHandler();
      const actorWithPermission = {
        ...mockActor,
        permissions: [PERMISSIONS.ACHIEVEMENTS_VIEW_HIDDEN] as PermissionKey[],
      };
      const event = new UserLoginEvent({
        userId: USER_ID,
        method: "password",
        actor: actorWithPermission,
      });

      await handler.handle(event);

      expect(gamificationQueueService.enqueueEvent).toHaveBeenCalledWith(
        expect.objectContaining({ canViewHidden: true }),
      );
    });
  });
});
