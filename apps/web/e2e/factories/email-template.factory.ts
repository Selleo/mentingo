import { randomUUID } from "node:crypto";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateTemplateBody,
  GetTemplateResponse,
  UpdateTemplateBody,
} from "~/api/generated-api";

export type EmailTemplateFactoryRecord = GetTemplateResponse["data"];
export type EmailTemplateFactoryCreateInput = Partial<CreateTemplateBody>;
export type EmailTemplateFactoryUpdateInput = UpdateTemplateBody;

const createEmailTemplateName = () => `Email template ${randomUUID().slice(0, 8)}`;

export class EmailTemplateFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: EmailTemplateFactoryCreateInput = {}): Promise<EmailTemplateFactoryRecord> {
    const response = await this.apiClient.api.emailNotificationTemplatesControllerCreateTemplate({
      name: input.name ?? createEmailTemplateName(),
      baseLanguage: input.baseLanguage ?? "en",
      availableLocales: input.availableLocales ?? ["en"],
      subject: input.subject ?? { en: "Smoke subject" },
      blocks: input.blocks ?? { type: "doc", content: [] },
      strings: input.strings ?? {},
    });

    return this.getById(response.data.data.id);
  }

  async getById(id: string): Promise<EmailTemplateFactoryRecord> {
    const response = await this.apiClient.api.emailNotificationTemplatesControllerGetTemplate(id);
    return response.data.data;
  }

  async update(
    id: string,
    data: EmailTemplateFactoryUpdateInput,
  ): Promise<EmailTemplateFactoryRecord> {
    const response = await this.apiClient.api.emailNotificationTemplatesControllerUpdateTemplate(
      id,
      data,
    );
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await this.apiClient.api.emailNotificationTemplatesControllerDeleteTemplate(id);
  }

  async safeGetById(id: string): Promise<EmailTemplateFactoryRecord | null> {
    try {
      return await this.getById(id);
    } catch {
      return null;
    }
  }
}
