import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type { CreateAnnouncementResponse, GetAllAnnouncementsResponse } from "~/api/generated-api";

export type AnnouncementFactoryRecord = CreateAnnouncementResponse["data"];
export type AnnouncementTranslationInput = {
  language: SupportedLanguages;
  title: string;
  content: string;
};
export type AnnouncementFactoryCreateInput = {
  groupId?: string | null;
  baseLanguage?: SupportedLanguages;
  translations?: AnnouncementTranslationInput[];
};

const createAnnouncementTranslation = (): AnnouncementTranslationInput => {
  const suffix = randomUUID().slice(0, 8);

  return {
    language: SUPPORTED_LANGUAGES.EN,
    title: `announcement-${suffix}`,
    content: `announcement-content-${suffix}`,
  };
};

export class AnnouncementFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: AnnouncementFactoryCreateInput = {}): Promise<AnnouncementFactoryRecord> {
    const response = await this.apiClient.api.announcementsControllerCreateAnnouncement({
      groupId: input.groupId ?? null,
      baseLanguage: input.baseLanguage ?? SUPPORTED_LANGUAGES.EN,
      translations: input.translations ?? [createAnnouncementTranslation()],
    });

    return response.data.data;
  }

  /** Creates the announcements one by one so their creation order is stable. */
  async createMany(count: number): Promise<AnnouncementFactoryRecord[]> {
    const announcements: AnnouncementFactoryRecord[] = [];

    for (let index = 0; index < count; index += 1) {
      announcements.push(await this.create());
    }

    return announcements;
  }

  async findByTitle(
    title: string,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ): Promise<GetAllAnnouncementsResponse["data"][number] | undefined> {
    const response = await this.apiClient.api.announcementsControllerGetAllAnnouncements({
      language,
    });

    return response.data.data.find((announcement) => announcement.title === title);
  }
}
