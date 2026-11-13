import { Injectable } from "@nestjs/common";
import { ENTITY_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { createLessonResourceIdRegex } from "src/lesson/lesson-resource-references";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { LessonMediaCompletionRepository } from "./repositories/lesson-media-completion.repository";

import type { CompleteLessonWhenRequiredMediaConsumedParams } from "./lesson-media-completion.types";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class LessonMediaCompletionService {
  constructor(
    private readonly lessonMediaCompletionRepository: LessonMediaCompletionRepository,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
  ) {}

  async completeLessonWhenRequiredMediaConsumed(
    params: CompleteLessonWhenRequiredMediaConsumedParams,
    dbInstance: DatabasePg,
  ) {
    const requiredMediaConsumed = await this.isEveryRequiredMediaConsumed(params, dbInstance);

    if (requiredMediaConsumed && !params.lessonCompleted) {
      await this.studentLessonProgressService.markLessonAsCompleted({
        id: params.lessonId,
        studentId: params.currentUser.userId,
        userPermissions: params.currentUser.permissions,
        actor: params.currentUser,
        dbInstance,
        language: params.language ?? SUPPORTED_LANGUAGES.EN,
      });
    }

    return requiredMediaConsumed || params.lessonCompleted;
  }

  private async isEveryRequiredMediaConsumed(
    params: CompleteLessonWhenRequiredMediaConsumedParams,
    dbInstance: DatabasePg,
  ) {
    if (!params.videoCompletionTrackingEnabled && !params.audioCompletionTrackingEnabled) {
      return false;
    }

    const { internalVideoResourceEntityIds, internalAudioResourceEntityIds } =
      await this.getInternalMediaResourceEntityIdsInContent(
        params.lessonId,
        params.language,
        dbInstance,
      );
    const studentId = params.currentUser.userId;

    const requiredVideos =
      params.videoCompletionTrackingEnabled && internalVideoResourceEntityIds.length > 0
        ? await this.lessonMediaCompletionRepository.getRequiredVideoProgressForLesson(
            {
              lessonId: params.lessonId,
              studentId,
              resourceEntityIds: internalVideoResourceEntityIds,
            },
            dbInstance,
          )
        : [];
    const requiredAudios =
      params.audioCompletionTrackingEnabled && internalAudioResourceEntityIds.length > 0
        ? await this.lessonMediaCompletionRepository.getRequiredAudioProgressForLesson(
            {
              lessonId: params.lessonId,
              studentId,
              resourceEntityIds: internalAudioResourceEntityIds,
            },
            dbInstance,
          )
        : [];

    const requiredMediaConsumption = [
      ...requiredVideos.map((video) => video.isWatched),
      ...requiredAudios.map((audio) => audio.isListened),
    ];

    return requiredMediaConsumption.length > 0 && requiredMediaConsumption.every(Boolean);
  }

  private async getInternalMediaResourceEntityIdsInContent(
    lessonId: UUIDType,
    language: SupportedLanguages | undefined,
    dbInstance: DatabasePg,
  ) {
    const [lessonDescription, lessonResources] = await Promise.all([
      this.lessonMediaCompletionRepository.getLocalizedLessonDescription(
        lessonId,
        language,
        dbInstance,
      ),
      this.fileService.getResourcesForEntity(
        lessonId,
        ENTITY_TYPES.LESSON,
        RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      ),
    ]);

    return injectResourcesIntoContent(
      lessonDescription,
      lessonResources.map((resource) => ({
        id: resource.id,
        resourceEntityId: resource.resourceEntityId,
        fileUrl: resource.fileUrl,
        fileUrlError: resource.fileUrlError,
        contentType: resource.contentType,
      })),
      {
        resourceIdRegex: createLessonResourceIdRegex(),
        trackNodeTypes: ["video", "audio"],
        convertImageAnchors: false,
      },
    );
  }
}
