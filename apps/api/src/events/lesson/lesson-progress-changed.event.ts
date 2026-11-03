import type { ActorUserType } from "src/common/types/actor-user.type";

export class LessonProgressChangedEvent {
  constructor(
    public readonly data: {
      userId: string;
      courseId: string;
      lessonId: string;
      actor: ActorUserType;
    },
  ) {}
}
