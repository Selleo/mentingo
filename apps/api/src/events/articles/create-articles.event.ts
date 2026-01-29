import type { SupportedLanguages } from "@repo/shared";
import type { ArticleActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ArticleCreationData = {
  articleId: UUIDType;
  actor: ActorUserType;
  createdArticle: ArticleActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateArticleEvent {
  constructor(public readonly articleCreationData: ArticleCreationData) {}
}
