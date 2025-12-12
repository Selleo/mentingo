import type { QuestionsAndAnswersActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type QAUpdateData = {
  qaId: UUIDType;
  actor: CurrentUser;
  previousQAData: QuestionsAndAnswersActivityLogSnapshot | null;
  updatedQAData: QuestionsAndAnswersActivityLogSnapshot | null;
};

export class UpdateQAEvent {
  constructor(public readonly updateQAData: QAUpdateData) {}
}
