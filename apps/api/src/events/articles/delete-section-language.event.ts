import type { SupportedLanguages } from "@repo/shared";
import type { ArticleSectionActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteSectionLanguageData = {
  articleSectionId: UUIDType;
  actor: ActorUserType;
  updatedArticleSectionData: ArticleSectionActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "remove_language";
};

export class DeleteSectionLanguageEvent {
  constructor(public readonly articleSectionUpdateData: DeleteSectionLanguageData) {}
}
