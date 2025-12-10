import { BadRequestException, Injectable } from "@nestjs/common";

import { QARepository } from "src/qa/repositories/qa.repository";
import { SettingsService } from "src/settings/settings.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CreateQABody, QAUpdateBody } from "src/qa/schemas/qa.schema";

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
    await this.checkAccess(currentUserId);

    return this.qaRepository.getQA(qaId, language);
  }

  async getAllQA(language: SupportedLanguages, currentUserId?: UUIDType) {
    await this.checkAccess(currentUserId);

    return this.qaRepository.getAllQA(language);
  }

  async createLanguage(qaId: UUIDType, language: SupportedLanguages) {
    const { availableLocales } = await this.qaRepository.getQA(qaId);

    if (availableLocales.includes(language)) {
      throw new BadRequestException({ message: "qaView.toast.languageAlreadyExists" });
    }

    const newLanguages = [...availableLocales, language];

    await this.qaRepository.createLanguage(qaId, newLanguages);
  }

  async updateQA(data: QAUpdateBody, qaId: UUIDType, language: SupportedLanguages) {
    const { availableLocales } = await this.qaRepository.getQA(qaId, language);

    if (!availableLocales.includes(language)) {
      throw new BadRequestException({ message: "qaView.toast.languageNotSupported" });
    }

    await this.qaRepository.updateQA(data, language, qaId);
  }

  async deleteQA(qaId: UUIDType) {
    return this.qaRepository.deleteQA(qaId);
  }

  async deleteLanguage(qaId: UUIDType, language: SupportedLanguages) {
    const { availableLocales, baseLanguage } = await this.qaRepository.getQA(qaId, language);

    if (!availableLocales.includes(language) || language === baseLanguage) {
      throw new BadRequestException({ message: "qaView.toast.cannotDeleteLanguage" });
    }

    return this.qaRepository.deleteLanguage(qaId, language);
  }

  private async checkAccess(currentUserId?: UUIDType) {
    const { QAEnabled, unregisteredUserQAAccessibility } =
      await this.settingsService.getGlobalSettings();

    const hasAccess = Boolean(QAEnabled && (currentUserId || unregisteredUserQAAccessibility));

    if (!hasAccess) {
      throw new BadRequestException({ message: "common.toast.noAccess" });
    }
  }
}
