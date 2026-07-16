import type { SupportedLanguages } from "@repo/shared";
import type { ArticleActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LanguageCreateData = {
  articleId: UUIDType;
  actor: ActorUserType;
  previousArticleData: ArticleActivityLogSnapshot;
  updatedArticleData: ArticleActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "add_language";
};

export class CreateArticleLanguageEvent {
  constructor(public readonly articleUpdateData: LanguageCreateData) {}
}
