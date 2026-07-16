import type { SupportedLanguages } from "@repo/shared";
import type { ArticleSectionActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CreateSectionLanguageData = {
  articleSectionId: UUIDType;
  actor: ActorUserType;
  previousArticleSectionData: ArticleSectionActivityLogSnapshot;
  updatedArticleSectionData: ArticleSectionActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "add_language";
};

export class CreateSectionLanguageEvent {
  constructor(public readonly articleSectionUpdateData: CreateSectionLanguageData) {}
}
