import type { SupportedLanguages } from "@repo/shared";
import type { ArticleActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ArticleCreationData = {
  articleId: UUIDType;
  actor: CurrentUser;
  createdArticle: ArticleActivityLogSnapshot;
  language: SupportedLanguages;
};

export class CreateArticleEvent {
  constructor(public readonly articleCreationData: ArticleCreationData) {}
}
