import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ArticleDeleteData = {
  articleId: UUIDType;
  actor: ActorUserType;
  language?: SupportedLanguages;
  title?: string | null;
  baseLanguage?: SupportedLanguages;
  availableLocales?: SupportedLanguages[];
};

export class DeleteArticleEvent {
  constructor(public readonly articleDeleteData: ArticleDeleteData) {}
}
