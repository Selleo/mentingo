import type { QuestionsAndAnswersActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CreateQAData = {
  qaId: UUIDType;
  actor: CurrentUser;
  createdQA: QuestionsAndAnswersActivityLogSnapshot;
};

export class CreateQAEvent {
  constructor(public readonly createQAData: CreateQAData) {}
}
