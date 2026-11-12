import {
  LessonCompletedEvent,
  QuizCompletedEvent,
  USER_LOGIN_METHOD,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";
import { rehydrateOutboxEvent } from "src/outbox/utils/outbox-event-rehydration.utils";
import { dbAls } from "src/storage/db/db-als.store";

import { GamificationEventsHandler } from "./gamification-events.handler";

import type { GamificationQueueService } from "./gamification-queue.service";
import type { ActorUserType } from "src/common/types/actor-user.type";

const TENANT_ID = "tenant-1";
const USER_ID = "user-1";

const actor = (isSupportMode = false) =>
  ({ userId: USER_ID, isSupportMode }) as unknown as ActorUserType;

const quiz = (isSupportMode = false) =>
  new QuizCompletedEvent({
    userId: USER_ID,
    courseId: "course-1",
    lessonId: "lesson-1",
    correctAnswers: 1,
    wrongAnswers: 0,
    score: 100,
    isSupportMode,
  });

// Mirrors how the outbox stores events: class name as type, JSON payload.
type GamificationSourceEvent =
  | UserLoginEvent
  | LessonCompletedEvent
  | UserCourseFinishedEvent
  | QuizCompletedEvent;

const EVENTS: GamificationSourceEvent[] = [
  new UserLoginEvent({ userId: USER_ID, method: USER_LOGIN_METHOD.PASSWORD, actor: actor() }),
  new LessonCompletedEvent({
    userId: USER_ID,
    courseId: "course-1",
    lessonId: "lesson-1",
    actor: actor(),
  }),
  new UserCourseFinishedEvent({ userId: USER_ID, courseId: "course-1", actor: actor() }),
  quiz(),
];

describe("GamificationEventsHandler", () => {
  const gamificationQueueService = {
    enqueueEvaluateUser: jest.fn(),
  } as unknown as jest.Mocked<GamificationQueueService>;
  const handler = new GamificationEventsHandler(gamificationQueueService);

  const react = (event: GamificationSourceEvent, tenantId: string | null = TENANT_ID) => {
    const storedEvent = rehydrateOutboxEvent<GamificationSourceEvent>(
      event.constructor as never,
      JSON.parse(JSON.stringify(event)),
    );
    const deliver = () => handler.handleOutboxEvent(storedEvent, { eventId: "event-1" });

    if (!tenantId) return deliver();

    return dbAls.run({ tenantId }, deliver);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(EVENTS.map((event) => [event.constructor.name, event]))(
    "queues an evaluation for %s",
    async (_name, event) => {
      await react(event);

      expect(gamificationQueueService.enqueueEvaluateUser).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: USER_ID,
        sourceEventId: "event-1",
      });
    },
  );

  it.each([
    [
      "support-mode lessons",
      new LessonCompletedEvent({
        userId: USER_ID,
        courseId: "course-1",
        lessonId: "lesson-1",
        actor: actor(true),
      }),
    ],
    ["support-mode quizzes", quiz(true)],
  ])("skips %s", async (_name, event) => {
    await react(event);

    expect(gamificationQueueService.enqueueEvaluateUser).not.toHaveBeenCalled();
  });

  it("skips events without a tenant context", async () => {
    await react(quiz(), null);

    expect(gamificationQueueService.enqueueEvaluateUser).not.toHaveBeenCalled();
  });
});
