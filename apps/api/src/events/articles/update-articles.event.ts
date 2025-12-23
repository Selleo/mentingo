import type { SupportedLanguages } from "@repo/shared";
import type { ArticleActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ArticleUpdateData = {
  articleId: UUIDType;
  actor: CurrentUser;
  previousArticleData: ArticleActivityLogSnapshot;
  updatedArticleData: ArticleActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "update" | "add_language" | "remove_language";
};

export class UpdateArticleEvent {
  constructor(public readonly articleUpdateData: ArticleUpdateData) {}
}
