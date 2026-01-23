import type { QuestionsAndAnswersActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type QAUpdateData = {
  qaId: UUIDType;
  actor: ActorUserType;
  previousQAData: QuestionsAndAnswersActivityLogSnapshot | null;
  updatedQAData: QuestionsAndAnswersActivityLogSnapshot | null;
};

export class UpdateQAEvent {
  constructor(public readonly updateQAData: QAUpdateData) {}
}
