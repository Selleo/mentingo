import { Injectable } from "@nestjs/common";

import { QARepository } from "src/qa/repositories/qa.repository";
import { SettingsService } from "src/settings/settings.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CreateQABody } from "src/qa/schemas/qa.schema";

@Injectable()
export class QAService {
  constructor(
    private readonly qaRepository: QARepository,
    private readonly settingsService: SettingsService,
  ) {}

  async createQA(data: CreateQABody, currentUserId: UUIDType) {
    return this.qaRepository.createQA(data, { createdBy: currentUserId });
  }

  async getQA(qaId: UUIDType, language: SupportedLanguages, currentUserId?: UUIDType) {
    const { QAEnabled, unregisteredUserQAAccessibility } =
      await this.settingsService.getGlobalSettings();

    const hasAccess = Boolean(QAEnabled && (currentUserId || unregisteredUserQAAccessibility));

    if (hasAccess) {

    }
  }

  async createLanguage(qaId: UUIDType, language: SupportedLanguages) {}
}
