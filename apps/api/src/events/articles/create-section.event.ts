import type { SupportedLanguages } from "@repo/shared";
import type { ArticleSectionActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ArticleSectionCreationData = {
  articleSectionId: UUIDType;
  actor: CurrentUser;
  createdArticleSection: ArticleSectionActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateArticleSectionEvent {
  constructor(public readonly articleSectionCreationData: ArticleSectionCreationData) {}
}
