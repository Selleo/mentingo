import type { SupportedLanguages } from "@repo/shared";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type NewsCreationData = {
  newsId: UUIDType;
  actor: CurrentUser;
  createdNews: NewsActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateNewsEvent {
  constructor(public readonly newsCreationData: NewsCreationData) {}
}
