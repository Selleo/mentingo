import { randomUUID } from "node:crypto";

import { isAxiosError } from "axios";

import {
  EMAIL_TEMPLATE_DATA,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  emailTemplateDocument,
} from "../data/test-data/email-template.data";

import type { FixtureApiClient } from "../utils/api-client";
import type { CreateEmailTemplateBody, UpdateEmailTemplateBody } from "~/api/generated-api";

export class EmailTemplateFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async create(input: Partial<CreateEmailTemplateBody> = {}) {
    return (
      await this.apiClient.api.emailTemplateManagementControllerCreateEmailTemplate({
        placeholders: EMAIL_TEMPLATE_PLACEHOLDERS,
        baseLanguage: EMAIL_TEMPLATE_DATA.english,
        name: { en: `${EMAIL_TEMPLATE_DATA.namePrefix} ${randomUUID()}` },
        subject: { en: EMAIL_TEMPLATE_DATA.subject },
        content: { en: emailTemplateDocument(EMAIL_TEMPLATE_DATA.body) },
        ...input,
      })
    ).data.data;
  }

  async getById(id: string) {
    return (await this.apiClient.api.emailTemplateManagementControllerGetEmailTemplate(id)).data
      .data;
  }

  async getDefault() {
    return (
      await this.apiClient.api.emailTemplateManagementControllerGetBuiltInEmailTemplate(
        EMAIL_TEMPLATE_DATA.builtInTemplateKey,
      )
    ).data.data;
  }

  async update(id: string, body: UpdateEmailTemplateBody) {
    return (await this.apiClient.api.emailTemplateManagementControllerUpdateEmailTemplate(id, body))
      .data.data;
  }

  async publish(id: string) {
    return (await this.apiClient.api.emailTemplateManagementControllerPublishEmailTemplate(id)).data
      .data;
  }

  async exists(id: string) {
    try {
      await this.getById(id);
      return true;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return false;
      throw error;
    }
  }

  async delete(id: string) {
    try {
      await this.apiClient.api.emailTemplateManagementControllerDeleteEmailTemplate(id);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return;
      throw error;
    }
  }
}
