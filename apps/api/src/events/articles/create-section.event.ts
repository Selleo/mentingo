import type { SupportedLanguages } from "@repo/shared";
import type { ArticleSectionActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ArticleSectionCreationData = {
  articleSectionId: UUIDType;
  actor: ActorUserType;
  createdArticleSection: ArticleSectionActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateArticleSectionEvent {
  constructor(public readonly articleSectionCreationData: ArticleSectionCreationData) {}
}
