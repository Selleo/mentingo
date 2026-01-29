import type { SupportedLanguages } from "@repo/shared";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type NewsCreationData = {
  newsId: UUIDType;
  actor: ActorUserType;
  createdNews: NewsActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateNewsEvent {
  constructor(public readonly newsCreationData: NewsCreationData) {}
}
