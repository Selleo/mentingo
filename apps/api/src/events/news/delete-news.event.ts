import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type NewsDeleteData = {
  newsId: UUIDType;
  actor: CurrentUser;
  language?: SupportedLanguages;
  title?: string | null;
  baseLanguage?: SupportedLanguages;
  availableLocales?: SupportedLanguages[];
};

export class DeleteNewsEvent {
  constructor(public readonly newsDeleteData: NewsDeleteData) {}
}
