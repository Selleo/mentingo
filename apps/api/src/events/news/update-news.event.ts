import type { SupportedLanguages } from "@repo/shared";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type NewsUpdateData = {
  newsId: UUIDType;
  actor: ActorUserType;
  previousNewsData: NewsActivityLogSnapshot;
  updatedNewsData: NewsActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "update" | "add_language" | "remove_language";
};

export class UpdateNewsEvent {
  constructor(public readonly newsUpdateData: NewsUpdateData) {}
}
