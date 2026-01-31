import type { QuestionsAndAnswersActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CreateQAData = {
  qaId: UUIDType;
  actor: ActorUserType;
  createdQA: QuestionsAndAnswersActivityLogSnapshot;
};

export class CreateQAEvent {
  constructor(public readonly createQAData: CreateQAData) {}
}
