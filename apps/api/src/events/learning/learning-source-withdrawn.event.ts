import type { ActorUserType } from "src/common/types/actor-user.type";

export class LearningSourceWithdrawnEvent {
  constructor(
    public readonly data: {
      userId: string;
      courseId: string;
      actor: ActorUserType;
    },
  ) {}
}
