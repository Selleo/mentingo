import { randomUUID } from "node:crypto";

import type { FixtureApiClient } from "../utils/api-client";
import type { SupportedLanguages } from "@repo/shared";
import type {
  CreateQABody,
  GetAllQAResponse,
  GetQAResponse,
  UpdateQABody,
} from "~/api/generated-api";

export type QAFactoryRecord = GetQAResponse;
export type QAFactoryListRecord = GetAllQAResponse[number];
export type QAFactoryCreateInput = {
  language?: SupportedLanguages;
  title?: string;
  description?: string;
};
export type QAFactoryUpdateInput = {
  language?: SupportedLanguages;
  title?: string;
  description?: string;
};

const createQADefaults = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    title: `Q&A question ${suffix}`,
    description: `Q&A answer ${suffix}`,
  };
};

export class QAFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: QAFactoryCreateInput = {}): Promise<QAFactoryRecord> {
    const language = input.language ?? "en";
    const defaults = createQADefaults();
    const title = input.title ?? defaults.title;

    await this.apiClient.api.qaControllerCreateQa({
      language,
      title,
      description: input.description ?? defaults.description,
    } satisfies CreateQABody);

    const created = await this.findByTitle(title, language);

    if (!created) {
      throw new Error(`Failed to find created Q&A entry with title "${title}"`);
    }

    return this.getById(created.id, language);
  }

  async getById(id: string, language: SupportedLanguages = "en"): Promise<QAFactoryRecord> {
    const response = await this.apiClient.api.qaControllerGetQa(id, { language });
    return response.data;
  }

  async getAll(language: SupportedLanguages = "en"): Promise<GetAllQAResponse> {
    const response = await this.apiClient.api.qaControllerGetAllQa({ language });
    return response.data;
  }

  async findByTitle(
    title: string,
    language: SupportedLanguages = "en",
  ): Promise<QAFactoryListRecord | null> {
    const response = await this.apiClient.api.qaControllerGetAllQa({
      language,
      searchQuery: title,
    });

    return response.data.find((qa) => qa.title === title) ?? null;
  }

  async update(id: string, input: QAFactoryUpdateInput): Promise<QAFactoryRecord> {
    const language = input.language ?? "en";

    await this.apiClient.api.qaControllerUpdateQa(
      id,
      {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
      } satisfies UpdateQABody,
      { language },
    );

    return this.getById(id, language);
  }

  async createLanguage(id: string, language: SupportedLanguages): Promise<QAFactoryRecord> {
    await this.apiClient.api.qaControllerCreateLanguage(id, { language });
    return this.getById(id, language);
  }

  async deleteLanguage(id: string, language: SupportedLanguages): Promise<void> {
    await this.apiClient.api.qaControllerDeleteLanguage(id, { language });
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.qaControllerDeleteQa(id);
  }

  async safeGetById(
    id: string,
    language: SupportedLanguages = "en",
  ): Promise<QAFactoryRecord | null> {
    try {
      return await this.getById(id, language);
    } catch {
      return null;
    }
  }
}
