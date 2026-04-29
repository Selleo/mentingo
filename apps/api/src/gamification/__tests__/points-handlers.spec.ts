import { UserAiMentorLessonPassedEvent } from "src/events/user/user-ai-mentor-lesson-passed.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { POINT_EVENT_TYPES } from "src/gamification/gamification.constants";
import { UserAiMentorLessonPassedPointsHandler } from "src/gamification/handlers/user-ai-mentor-lesson-passed-points.handler";
import { UserChapterFinishedPointsHandler } from "src/gamification/handlers/user-chapter-finished-points.handler";
import { UserCourseFinishedPointsHandler } from "src/gamification/handlers/user-course-finished-points.handler";

import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

const userId = "00000000-0000-0000-0000-000000000001" as UUIDType;
const chapterId = "00000000-0000-0000-0000-000000000002" as UUIDType;
const tenantId = "00000000-0000-0000-0000-000000000003" as UUIDType;
const courseId = "00000000-0000-0000-0000-000000000004" as UUIDType;
const lessonId = "00000000-0000-0000-0000-000000000005" as UUIDType;

const actor: ActorUserType = {
  userId,
  email: "student@example.com",
  roleSlugs: [],
  permissions: [],
  tenantId,
};

const createPointsService = () => ({
  award: jest.fn(async () => ({ pointsAwarded: 0 })),
});

describe("gamification points event handlers", () => {
  it("awards chapter completion points from UserChapterFinishedEvent", async () => {
    const pointsService = createPointsService();
    const handler = new UserChapterFinishedPointsHandler(pointsService as never);

    await handler.handle(new UserChapterFinishedEvent({ chapterId, courseId, userId, actor }));

    expect(pointsService.award).toHaveBeenCalledWith(
      userId,
      POINT_EVENT_TYPES.CHAPTER_COMPLETED,
      chapterId,
      tenantId,
    );
  });

  it("awards course completion points from UserCourseFinishedEvent", async () => {
    const pointsService = createPointsService();
    const handler = new UserCourseFinishedPointsHandler(pointsService as never);

    await handler.handle(new UserCourseFinishedEvent({ courseId, userId, actor }));

    expect(pointsService.award).toHaveBeenCalledWith(
      userId,
      POINT_EVENT_TYPES.COURSE_COMPLETED,
      courseId,
      tenantId,
    );
  });

  it("awards AI mentor pass points from UserAiMentorLessonPassedEvent", async () => {
    const pointsService = createPointsService();
    const handler = new UserAiMentorLessonPassedPointsHandler(pointsService as never);

    await handler.handle(new UserAiMentorLessonPassedEvent({ lessonId, userId, actor }));

    expect(pointsService.award).toHaveBeenCalledWith(
      userId,
      POINT_EVENT_TYPES.AI_MENTOR_PASSED,
      lessonId,
      tenantId,
    );
  });
});
