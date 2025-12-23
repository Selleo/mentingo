import type { SupportedLanguages } from "@repo/shared";
import type { ArticleSectionActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ArticleSectionUpdateData = {
  articleSectionId: UUIDType;
  actor: CurrentUser;
  previousArticleSectionData: ArticleSectionActivityLogSnapshot;
  updatedArticleSectionData: ArticleSectionActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "update" | "add_language" | "remove_language";
};

export class UpdateArticleSectionEvent {
  constructor(public readonly articleSectionUpdateData: ArticleSectionUpdateData) {}
}
