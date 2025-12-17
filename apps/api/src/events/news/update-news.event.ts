import type { SupportedLanguages } from "@repo/shared";
import type { NewsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type NewsUpdateData = {
  newsId: UUIDType;
  actor: CurrentUser;
  previousNewsData: NewsActivityLogSnapshot;
  updatedNewsData: NewsActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "update" | "add_language" | "remove_language";
};

export class UpdateNewsEvent {
  constructor(public readonly newsUpdateData: NewsUpdateData) {}
}
