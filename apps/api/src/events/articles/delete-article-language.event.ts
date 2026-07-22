import type { SupportedLanguages } from "@repo/shared";
import type { ArticleActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteLanguageData = {
  articleId: UUIDType;
  actor: ActorUserType;
  previousArticleData: ArticleActivityLogSnapshot;
  language?: SupportedLanguages;
  action?: "remove_language";
};

export class DeleteArticleLanguageEvent {
  constructor(public readonly articleUpdateData: DeleteLanguageData) {}
}
