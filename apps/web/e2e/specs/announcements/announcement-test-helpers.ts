import { SUPPORTED_LANGUAGES } from "@repo/shared";

import type { FixtureApiClient } from "../../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type { CreateAnnouncementBody, CreateAnnouncementResponse } from "~/api/generated-api";

type TranslationInput = {
  language: SupportedLanguages;
  title: string;
  content: string;
};

type CreateAnnouncementInput = {
  groupId?: string | null;
  translations: TranslationInput[];
  baseLanguage?: SupportedLanguages;
};

export const buildCreateAnnouncementBody = ({
  groupId = null,
  translations,
  baseLanguage = SUPPORTED_LANGUAGES.EN,
}: CreateAnnouncementInput): CreateAnnouncementBody => ({
  groupId,
  baseLanguage,
  translations,
});

export const createAnnouncement = async (
  apiClient: FixtureApiClient,
  input: CreateAnnouncementInput,
): Promise<CreateAnnouncementResponse["data"]> => {
  const { data } = await apiClient.api.announcementsControllerCreateAnnouncement(
    buildCreateAnnouncementBody(input),
  );

  return data.data;
};
