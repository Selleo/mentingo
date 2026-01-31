import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type NewsDeleteData = {
  newsId: UUIDType;
  actor: ActorUserType;
  language?: SupportedLanguages;
  title?: string | null;
  baseLanguage?: SupportedLanguages;
  availableLocales?: SupportedLanguages[];
};

export class DeleteNewsEvent {
  constructor(public readonly newsDeleteData: NewsDeleteData) {}
}
