import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { CreateQAEvent } from "src/events/qa/create-qa.event";
import { DeleteQAEvent } from "src/events/qa/delete-qa.event";
import { UpdateQAEvent } from "src/events/qa/update-qa.event";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QARepository } from "src/qa/repositories/qa.repository";
import { SettingsService } from "src/settings/settings.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { CreateQABody, QAUpdateBody } from "src/qa/schemas/qa.schema";

@Injectable()
export class QAService {
  constructor(
    private readonly qaRepository: QARepository,
    private readonly settingsService: SettingsService,
    private readonly localizationService: LocalizationService,
    private readonly eventBus: EventBus,
  ) {}

  async createQA(data: CreateQABody, currentUser: CurrentUser) {
    const [qa] = await this.qaRepository.createQA(data, { createdBy: currentUser.userId });

    this.eventBus.publish(
      new CreateQAEvent({
        qaId: qa.id,
        actor: currentUser,
        createdQA: qa,
      }),
    );
  }

  async getQA(qaId: UUIDType, language: SupportedLanguages) {
    return this.qaRepository.getQA(qaId, language);
  }

  async getAllQA(language: SupportedLanguages, currentUserId?: UUIDType) {
    await this.checkAccess(currentUserId);

    return this.qaRepository.getAllQA(language);
  }

  async createLanguage(qaId: UUIDType, language: SupportedLanguages, currentUser: CurrentUser) {
    const qa = await this.qaRepository.getQA(qaId, language);

    if (!qa) throw new NotFoundException({ message: "qaView.toast.notFound" });

    if (qa.availableLocales.includes(language)) {
      throw new BadRequestException({ message: "qaView.toast.languageAlreadyExists" });
    }

    const newLanguages = [...qa.availableLocales, language];

    const [updatedQA] = await this.qaRepository.createLanguage(qaId, newLanguages, language);

    this.eventBus.publish(
      new UpdateQAEvent({
        actor: currentUser,
        previousQAData: qa,
        updatedQAData: updatedQA,
        qaId,
      }),
    );

    return updatedQA;
  }

  async updateQA(
    data: QAUpdateBody,
    qaId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUser,
  ) {
    const qa = await this.qaRepository.getQA(qaId, language);

    if (!(data.title || data.description))
      throw new BadRequestException({ message: "qaView.toast.noDataToUpdate" });

    if (!qa.availableLocales.includes(language)) {
      throw new BadRequestException({ message: "qaView.toast.languageNotSupported" });
    }

    const [updatedQA] = await this.qaRepository.updateQA(data, language, qaId);

    this.eventBus.publish(
      new UpdateQAEvent({
        actor: currentUser,
        previousQAData: qa,
        updatedQAData: updatedQA,
        qaId,
      }),
    );

    return updatedQA;
  }

  async deleteQA(qaId: UUIDType, currentUser: CurrentUser) {
    const { baseLanguage } = await this.localizationService.getBaseLanguage(ENTITY_TYPE.QA, qaId);

    const qa = await this.qaRepository.getQA(qaId, baseLanguage);

    if (!qa) throw new BadRequestException({ message: "qaView.toast.notFound" });

    this.eventBus.publish(
      new DeleteQAEvent({
        qaId,
        qaName: qa.title,
        actor: currentUser,
      }),
    );

    return this.qaRepository.deleteQA(qaId);
  }

  async deleteLanguage(qaId: UUIDType, language: SupportedLanguages, currentUser: CurrentUser) {
    const qa = await this.qaRepository.getQA(qaId, language);

    if (!qa) throw new BadRequestException({ message: "qaView.toast.notFound" });

    if (!qa.availableLocales.includes(language) || language === qa.baseLanguage) {
      throw new BadRequestException({ message: "qaView.toast.cannotDeleteLanguage" });
    }

    const [updatedQA] = await this.qaRepository.deleteLanguage(qaId, language);

    this.eventBus.publish(
      new UpdateQAEvent({
        previousQAData: qa,
        updatedQAData: updatedQA,
        actor: currentUser,
        qaId,
      }),
    );

    return updatedQA;
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
