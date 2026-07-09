import { createLumaClient, isLumaCourseGeneratedEvent } from "@japro/luma-sdk";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { COURSE_GENERATION_SYNC_STATUS } from "@repo/shared";
import { isAxiosError } from "axios";

import { EnvService } from "src/env/services/env.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS } from "src/luma/luma-course-generation-sync.constants";
import { LumaCourseGenerationSyncRepository } from "src/luma/luma-course-generation-sync.repository";

import type {
  ChatOptions,
  CreateDraftOptions,
  DeleteIngestedDocumentOptions,
  IngestDraftFileResponse,
  IntegrationIdOptions,
} from "@japro/luma-sdk";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LumaCourseGenerationSyncRecord } from "src/luma/luma-course-generation-sync.repository";
import type { LumaClient } from "src/luma/luma.types";

@Injectable()
export class LumaService {
  private readonly logger = new Logger(LumaService.name);

  constructor(
    private readonly envService: EnvService,
    private readonly adminLessonService: AdminLessonService,
    private readonly localizationService: LocalizationService,
    private readonly lumaCourseGenerationSyncRepository: LumaCourseGenerationSyncRepository,
  ) {}

  async getLumaClient() {
    this.logger.debug("creating Luma client");
    const apiKey = await this.envService
      .getEnv("LUMA_API_KEY")
      .then((r) => r.value)
      .catch(() => process.env.LUMA_API_KEY);
    const baseURL = process.env.LUMA_BASE_URL;

    if (!baseURL || !apiKey) {
      throw new BadRequestException("adminCourseView.toast.lumaNotConfigured");
    }

    this.logger.debug(`Luma client configured baseURL=${this.safeUrl(baseURL)}`);

    return createLumaClient({
      apiKey,
      baseURL,
    });
  }

  async getDraft(data: CreateDraftOptions, currentUser: CurrentUserType) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);
    const draft = await luma.courses.getDraft(data).catch((error) => {
      if (isAxiosError(error) && error.response?.status === 404) {
        return undefined;
      }

      this.handleLumaSdkError(error);
    });

    if (!draft) {
      const { language } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.COURSE,
        data.integrationId,
        data.courseLanguage as SupportedLanguages,
      );

      data.courseLanguage = language;

      const { draftId } = await this.withLumaErrorHandling(() => luma.courses.createDraft(data));

      return this.withCoreSyncStatus({
        integrationId: data.integrationId,
        draftId,
        isCourseGenerated: false,
      });
    }

    return this.withCoreSyncStatus({ integrationId: data.integrationId, ...draft });
  }

  async chatWithCourseAgent(
    data: ChatOptions,
    currentUser: CurrentUserType,
  ): Promise<Awaited<ReturnType<LumaClient["courses"]["chat"]>>> {
    this.logger.debug(`course generation chat preparing integrationId=${data.integrationId}`);
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: false,
    });
    this.logger.debug(
      `course generation chat calling Luma SDK integrationId=${data.integrationId}`,
    );

    const response = await this.withLumaErrorHandling(() => luma.courses.chat(data));
    this.logger.debug(
      `course generation chat Luma SDK returned integrationId=${data.integrationId}`,
    );

    return response;
  }

  async getCourseGenerationMessages(data: IntegrationIdOptions, currentUser: CurrentUserType) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);

    return this.withLumaErrorHandling(() => luma.courses.getDraftMessages(data));
  }

  async ingestCourseGenerationFiles(
    data: IntegrationIdOptions,
    files: Express.Multer.File[],
    currentUser: CurrentUserType,
  ): Promise<IngestDraftFileResponse[]> {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: true,
    });
    const responses: IngestDraftFileResponse[] = [];

    for (const file of files) {
      const lumaFile = new File([new Uint8Array(file.buffer)], file.originalname, {
        type: file.mimetype,
      });

      responses.push(
        await this.withLumaErrorHandling(() =>
          luma.courses.ingestFile({
            integrationId: data.integrationId,
            file: lumaFile,
          }),
        ),
      );
    }

    return responses;
  }

  async deleteCourseGenerationFile(
    data: DeleteIngestedDocumentOptions,
    currentUser: CurrentUserType,
  ) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser, {
      ensureCourseHasNoChapters: true,
    });

    return this.withLumaErrorHandling(() => luma.courses.deleteIngestedDocument(data));
  }

  async getCourseGenerationFiles(data: IntegrationIdOptions, currentUser: CurrentUserType) {
    const luma = await this.getAuthorizedLumaClient(data.integrationId, currentUser);

    return this.withLumaErrorHandling(() => luma.courses.getDraftFiles(data));
  }

  hasCourseGeneratedEvent(chunk: Buffer, pendingFrame = "") {
    const chunkString = `${pendingFrame}${chunk.toString()}`.replace(/\r\n/g, "\n");
    const hasTrailingNewline = chunkString.endsWith("\n");
    const frames = chunkString.split("\n");
    const nextPendingFrame = hasTrailingNewline ? "" : (frames.pop() ?? "");
    let hasCourseGeneratedEvent = false;

    for (const frame of frames) {
      if (!frame.trim()) continue;
      if (!frame.startsWith("2:")) continue;
      if (this.parseDataChunk(frame).some((payload) => this.isCourseGeneratedPayload(payload))) {
        hasCourseGeneratedEvent = true;
        break;
      }
    }

    return {
      hasCourseGeneratedEvent,
      pendingFrame: nextPendingFrame,
    };
  }

  private parseDataChunk(chunkString: string): unknown[] {
    const payload = chunkString.slice(2).trim();
    if (!payload) return [];

    try {
      const parsed = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  private isCourseGeneratedPayload(payload: unknown) {
    return isLumaCourseGeneratedEvent(payload);
  }

  private async withCoreSyncStatus<
    T extends { integrationId: UUIDType; draftId: string; isCourseGenerated: boolean },
  >(draft: T) {
    const sync = await this.lumaCourseGenerationSyncRepository.ensureNotStarted(
      draft.integrationId,
      draft.draftId as UUIDType,
    );

    return {
      ...draft,
      coreSync: this.serializeCoreSyncStatus(sync, draft.draftId as UUIDType),
    };
  }

  private serializeCoreSyncStatus(
    sync: LumaCourseGenerationSyncRecord | null,
    draftId: UUIDType | null,
  ) {
    return {
      status: sync?.status ?? COURSE_GENERATION_SYNC_STATUS.NOT_STARTED,
      draftId: sync?.draftId ?? draftId,
      attemptCount: sync?.attemptCount ?? 0,
      startedAt: sync?.startedAt ?? null,
      processedAt: sync?.processedAt ?? null,
      failedAt: sync?.failedAt ?? null,
      dismissedAt: sync?.dismissedAt ?? null,
      lastError:
        sync?.status === COURSE_GENERATION_SYNC_STATUS.FAILED && sync.lastError
          ? LUMA_COURSE_GENERATION_SYNC_MESSAGE_KEYS.FAILED
          : null,
    };
  }

  private async validateCourseHasChapters(integrationId: UUIDType) {
    this.logger.debug(`validating course has no chapters integrationId=${integrationId}`);
    if (await this.adminLessonService.courseHasChapters(integrationId)) {
      throw new ConflictException("adminCourseView.toast.courseHasChapters");
    }
    this.logger.debug(`course has no chapters integrationId=${integrationId}`);
  }

  private async validateCourseAccess(integrationId: string, currentUser: CurrentUserType) {
    this.logger.debug(`validating course access integrationId=${integrationId}`);
    await this.adminLessonService.validateAccess(ENTITY_TYPE.COURSE, currentUser, integrationId);
    this.logger.debug(`course access valid integrationId=${integrationId}`);
  }

  private async getAuthorizedLumaClient(
    integrationId: UUIDType,
    currentUser: CurrentUserType,
    options?: { ensureCourseHasNoChapters?: boolean },
  ) {
    this.logger.debug(`authorizing Luma client integrationId=${integrationId}`);
    await this.validateCourseAccess(integrationId, currentUser);

    if (options?.ensureCourseHasNoChapters) {
      await this.validateCourseHasChapters(integrationId);
    }

    const client = await this.getLumaClient();
    this.logger.debug(`authorized Luma client ready integrationId=${integrationId}`);

    return client;
  }

  private async withLumaErrorHandling<T>(cb: () => Promise<T>): Promise<T> {
    try {
      return await cb();
    } catch (error) {
      this.handleLumaSdkError(error);
    }
  }

  private handleLumaSdkError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (!isAxiosError(error)) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        throw new ServiceUnavailableException("adminCourseView.toast.lumaRequestTimeout");
      }

      throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
    }

    const status = error.response.status;

    if (status === 400) {
      throw new BadRequestException("adminCourseView.toast.lumaBadRequest");
    }

    if (status === 401 || status === 403) {
      throw new UnauthorizedException("adminCourseView.toast.lumaUnauthorized");
    }

    if (status === 404) {
      throw new NotFoundException("adminCourseView.toast.lumaResourceNotFound");
    }

    if (status === 408 || status === 504) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaRequestTimeout");
    }

    if (status === 409) {
      throw new ConflictException("adminCourseView.toast.lumaConflict");
    }

    if (status === 422) {
      throw new BadRequestException("adminCourseView.toast.lumaValidationFailed");
    }

    if (status === 429) {
      throw new ServiceUnavailableException("adminCourseView.toast.lumaRateLimited");
    }

    throw new ServiceUnavailableException("adminCourseView.toast.lumaServiceUnavailable");
  }

  private safeUrl(value: string): string {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return value;
    }
  }
}
