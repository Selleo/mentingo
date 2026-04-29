import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type UserAiMentorLessonPassed = {
  lessonId: UUIDType;
  userId: UUIDType;
  actor: ActorUserType;
};

export class UserAiMentorLessonPassedEvent {
  constructor(public readonly lessonPassedData: UserAiMentorLessonPassed) {}
}
