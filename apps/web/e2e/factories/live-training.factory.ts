import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  LIVE_TRAINING_DELIVERY_TYPES,
  SUPPORTED_LANGUAGES,
  type LiveTrainingResourceRelationshipType,
  type SupportedLanguages,
} from "@repo/shared";

import type { FixtureApiClient } from "../utils/api-client";
import type {
  CreateLiveTrainingBody,
  GetLiveTrainingResponse,
  StartSessionResponse,
  UpdateLiveTrainingBody,
} from "~/api/generated-api";

export type LiveTrainingFactoryRecord = GetLiveTrainingResponse["data"];
export type LiveTrainingFactoryCreateInput = Partial<CreateLiveTrainingBody>;
export type LiveTrainingResourceUploadInput = {
  contentType?: string;
  filePath: string;
  relationshipType: LiveTrainingResourceRelationshipType;
};

const getFutureDateOnScheduleStep = (minutesFromNow: number) => {
  const date = new Date();
  const currentMinutes = date.getMinutes();
  const minutesToNextStep = (5 - (currentMinutes % 5)) % 5;

  date.setMinutes(currentMinutes + minutesToNextStep + minutesFromNow, 0, 0);

  return date.toISOString();
};

export class LiveTrainingFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async ensureLiveTrainingEnabled() {
    const response = await this.apiClient.api.settingsControllerGetPublicGlobalSettings();

    if (!response.data.data.liveTrainingEnabled) {
      await this.apiClient.api.settingsControllerUpdateLiveTrainingEnabled();
    }
  }

  async createOffline(
    input: LiveTrainingFactoryCreateInput = {},
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ): Promise<LiveTrainingFactoryRecord> {
    await this.ensureLiveTrainingEnabled();

    const title = input.title ?? `Offline Live Training ${randomUUID().slice(0, 8)}`;
    await this.apiClient.api.liveTrainingControllerCreateLiveTraining({
      language,
      title,
      description: input.description ?? `Description for ${title}`,
      startsAt: input.startsAt ?? getFutureDateOnScheduleStep(60),
      endsAt: input.endsAt ?? getFutureDateOnScheduleStep(120),
      allDay: input.allDay ?? false,
      timezone: input.timezone ?? "Europe/Warsaw",
      location: input.location ?? "Training room",
      deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
      maxParticipants: input.maxParticipants ?? 20,
      settings: input.settings,
      hostUserIds: input.hostUserIds,
      linkedCourseIds: input.linkedCourseIds,
      beforeResourceIds: input.beforeResourceIds,
      afterResourceIds: input.afterResourceIds,
    });

    const createdLiveTraining = await this.findByTitle(title, language);

    if (!createdLiveTraining) {
      throw new Error(`Live training "${title}" was not found after creation`);
    }

    return this.get(createdLiveTraining.id, language);
  }

  async get(id: string, language: SupportedLanguages = SUPPORTED_LANGUAGES.EN) {
    const response = await this.apiClient.api.liveTrainingControllerGetLiveTraining(id, {
      language,
    });

    return response.data.data;
  }

  async update(
    id: string,
    data: Omit<UpdateLiveTrainingBody, "language">,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) {
    const response = await this.apiClient.api.liveTrainingControllerUpdateLiveTraining(id, {
      language,
      ...data,
    });

    return response.data.data;
  }

  async findByTitle(title: string, language: SupportedLanguages = SUPPORTED_LANGUAGES.EN) {
    const response = await this.apiClient.api.liveTrainingControllerGetLiveTrainings({
      page: 1,
      perPage: 100,
      language,
    });

    return response.data.data.find((liveTraining) => liveTraining.title === title) ?? null;
  }

  async startSession(id: string, language: SupportedLanguages = SUPPORTED_LANGUAGES.EN) {
    const response = await this.apiClient.api.liveTrainingSessionsControllerStartSession(id, {
      language,
    });

    return response.data.data;
  }

  async uploadResource(
    id: string,
    input: LiveTrainingResourceUploadInput,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) {
    const contents = await readFile(input.filePath);
    const file = new File([new Uint8Array(contents)], basename(input.filePath), {
      type: input.contentType ?? "application/octet-stream",
    });
    const response = await this.apiClient.api.liveTrainingControllerUploadLiveTrainingResource(id, {
      file,
      relationshipType: input.relationshipType,
      language,
    });

    return response.data.data;
  }

  async endSession(
    liveTrainingId: string,
    sessionId: StartSessionResponse["data"]["id"],
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) {
    const response = await this.apiClient.api.liveTrainingSessionsControllerEndSession(
      liveTrainingId,
      sessionId,
      { language },
    );

    return response.data.data;
  }

  async delete(id: string) {
    await this.apiClient.api.liveTrainingControllerDeleteLiveTraining(id);
  }
}
