import {
  LessonCompletedEvent,
  QuizCompletedEvent,
  USER_LOGIN_METHOD,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";
import { isOutboxProcessingEnabled } from "src/outbox/outbox.constants";
import { dbAls } from "src/storage/db/db-als.store";

import { GamificationEventsHandler } from "./gamification-events.handler";

import type { GamificationQueueService } from "./gamification-queue.service";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";

jest.mock("src/outbox/outbox.constants", () => ({
  ...jest.requireActual("src/outbox/outbox.constants"),
  isOutboxProcessingEnabled: jest.fn(),
}));

type Reaction = (payload: Record<string, unknown>, eventId: string) => Promise<void>;

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
const EVENTS = [
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
  const reactions = new Map<string, Reaction>();
  const outboxDirectHandlerService = {
    registerReaction: jest.fn((eventType: string, reaction: Reaction) => {
      reactions.set(eventType, reaction);
    }),
  } as unknown as OutboxDirectHandlerService;
  const gamificationQueueService = {
    enqueueEvaluateUser: jest.fn(),
  } as unknown as jest.Mocked<GamificationQueueService>;

  new GamificationEventsHandler(
    outboxDirectHandlerService,
    gamificationQueueService,
  ).onModuleInit();

  const react = (event: object, tenantId: string | null = TENANT_ID) => {
    const reaction = reactions.get(event.constructor.name);
    const payload = JSON.parse(JSON.stringify(event));

    if (!reaction) throw new Error(`No reaction for ${event.constructor.name}`);
    if (!tenantId) return reaction(payload, "event-1");

    return dbAls.run({ tenantId }, () => reaction(payload, "event-1"));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isOutboxProcessingEnabled).mockReturnValue(true);
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

  it("skips events while outbox processing is disabled", async () => {
    jest.mocked(isOutboxProcessingEnabled).mockReturnValue(false);

    await react(quiz());

    expect(gamificationQueueService.enqueueEvaluateUser).not.toHaveBeenCalled();
  });
});
