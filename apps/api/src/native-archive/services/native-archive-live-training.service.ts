import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ENTITY_TYPES,
  LESSON_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_STATUSES,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { NativeArchiveImportRepository } from "../repositories/native-archive-import.repository";
import {
  nativeArchiveLiveTrainingLessonsSchema,
  type NativeArchiveLiveTrainingLesson,
} from "../schemas/native-archive-live-training.schema";

import type {
  NativeArchiveLiveTrainingRestoreItem,
  NativeArchiveLiveTrainingRestoreState,
  NativeArchiveRestoredTraining,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

@Injectable()
export class NativeArchiveLiveTrainingService {
  constructor(private readonly nativeArchiveImportRepository: NativeArchiveImportRepository) {}

  async restoreLiveTrainingLessons(
    snapshot: SourceSnapshot,
    chapterMap: Map<UUIDType, UUIDType>,
    actor: CurrentUserType,
    targetCourseId: UUIDType,
  ): Promise<void> {
    const records = this.readLiveTrainingRecords(snapshot);

    if (!records) return;

    const restoreItems = this.prepareRestoreItems(snapshot, records, chapterMap);
    const state: NativeArchiveLiveTrainingRestoreState = {
      trainings: new Map(),
      lessons: new Map(),
    };

    for (const item of restoreItems) {
      await this.restoreLiveTrainingLesson(targetCourseId, item, actor, state);
    }

    await this.updateChapterLessonCounts(snapshot, chapterMap);
  }

  private readLiveTrainingRecords(
    snapshot: SourceSnapshot,
  ): NativeArchiveLiveTrainingLesson[] | null {
    const records = "liveTrainingLessons" in snapshot ? snapshot.liveTrainingLessons : undefined;

    if (records === undefined) {
      this.ensureNoUncoveredLiveTrainingLessons(snapshot, new Set());
      return null;
    }

    if (!Value.Check(nativeArchiveLiveTrainingLessonsSchema, records)) {
      throw new BadRequestException("nativeArchive.error.invalidLiveTraining");
    }

    const cleaned = Value.Clean(nativeArchiveLiveTrainingLessonsSchema, structuredClone(records));
    if (!Value.Check(nativeArchiveLiveTrainingLessonsSchema, cleaned)) {
      throw new BadRequestException("nativeArchive.error.invalidLiveTraining");
    }
    return cleaned;
  }

  private prepareRestoreItems(
    snapshot: SourceSnapshot,
    records: NativeArchiveLiveTrainingLesson[],
    chapterMap: Map<UUIDType, UUIDType>,
  ): NativeArchiveLiveTrainingRestoreItem[] {
    const lessonsById = new Map(snapshot.lessons.map((lesson) => [lesson.id, lesson]));
    const coveredLessonIds = new Set(records.map((record) => record.lessonId));

    this.ensureNoUncoveredLiveTrainingLessons(snapshot, coveredLessonIds);

    return records.map((record) => {
      const sourceLesson = lessonsById.get(record.lessonId);

      if (!sourceLesson || sourceLesson.type !== LESSON_TYPES.LIVE_TRAINING) {
        throw new BadRequestException("nativeArchive.error.invalidLiveTraining");
      }

      const mappedChapterId = chapterMap.get(sourceLesson.chapterId);

      if (!mappedChapterId) {
        throw new BadRequestException("nativeArchive.error.invalidLiveTraining");
      }

      return { record, sourceLesson, mappedChapterId };
    });
  }

  private ensureNoUncoveredLiveTrainingLessons(
    snapshot: SourceSnapshot,
    coveredLessonIds: Set<UUIDType>,
  ): void {
    const hasUncoveredLesson = snapshot.lessons.some(
      (lesson) => lesson.type === LESSON_TYPES.LIVE_TRAINING && !coveredLessonIds.has(lesson.id),
    );

    if (hasUncoveredLesson) {
      throw new BadRequestException("nativeArchive.error.liveTrainingIncomplete");
    }
  }

  private async restoreLiveTrainingLesson(
    targetCourseId: UUIDType,
    item: NativeArchiveLiveTrainingRestoreItem,
    actor: CurrentUserType,
    state: NativeArchiveLiveTrainingRestoreState,
  ): Promise<void> {
    const training = await this.restoreTrainingIfNeeded(targetCourseId, item.record, actor, state);
    const lessonId = await this.restoreLessonIfNeeded(item, state);

    await this.nativeArchiveImportRepository.createLiveLesson({
      lessonId,
      liveTrainingId: training.trainingId,
      liveTrainingLinkId: training.linkId,
      language: item.record.language,
    });
  }

  private async restoreTrainingIfNeeded(
    targetCourseId: UUIDType,
    record: NativeArchiveLiveTrainingLesson,
    actor: CurrentUserType,
    state: NativeArchiveLiveTrainingRestoreState,
  ): Promise<NativeArchiveRestoredTraining> {
    const sourceTrainingId = String(record.training.id);
    const restoredTraining = state.trainings.get(sourceTrainingId);

    if (restoredTraining) return restoredTraining;

    const calendarEventId = await this.nativeArchiveImportRepository.createCalendarEvent({
      ...record.event,
      uid: randomUUID(),
    });

    const { id: _sourceTrainingId, ...trainingFields } = record.training;

    const trainingId = await this.nativeArchiveImportRepository.createLiveTraining({
      ...trainingFields,
      calendarEventId,
      authorId: actor.userId,
      status: LIVE_TRAINING_STATUSES.SCHEDULED,
      metadata: {
        ...record.training.metadata,
        nativeArchiveReviewRequired: true,
      },
    });

    const linkId = await this.nativeArchiveImportRepository.createLiveTrainingLink({
      liveTrainingId: trainingId,
      entityType: LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE,
      entityId: targetCourseId,
    });

    const restored = { trainingId, linkId };

    await this.restoreTrainingMaterials(record, trainingId, actor);
    state.trainings.set(sourceTrainingId, restored);

    return restored;
  }

  private async restoreTrainingMaterials(
    record: NativeArchiveLiveTrainingLesson,
    trainingId: UUIDType,
    actor: CurrentUserType,
  ): Promise<void> {
    for (const material of record.materials) {
      const resourceId = await this.nativeArchiveImportRepository.createResource({
        ...material.resource,
        uploadedBy: actor.userId,
      });

      await this.nativeArchiveImportRepository.createResourceEntity({
        resourceId,
        entityId: trainingId,
        entityType: ENTITY_TYPES.LIVE_TRAINING,
        relationshipType: material.relationshipType,
      });
    }
  }

  private async restoreLessonIfNeeded(
    item: NativeArchiveLiveTrainingRestoreItem,
    state: NativeArchiveLiveTrainingRestoreState,
  ): Promise<UUIDType> {
    const existingLessonId = state.lessons.get(item.sourceLesson.id);

    if (existingLessonId) return existingLessonId;

    const { id: _sourceLessonId, ...lessonFields } = item.sourceLesson;
    const lessonId = await this.nativeArchiveImportRepository.createLesson({
      ...lessonFields,
      chapterId: item.mappedChapterId,
    });

    state.lessons.set(item.sourceLesson.id, lessonId);
    return lessonId;
  }

  private async updateChapterLessonCounts(
    snapshot: SourceSnapshot,
    chapterMap: Map<UUIDType, UUIDType>,
  ): Promise<void> {
    for (const sourceChapter of snapshot.chapters) {
      const targetChapterId = chapterMap.get(sourceChapter.id);

      if (!targetChapterId) continue;

      const lessonCount = snapshot.lessons.filter(
        (lesson) => lesson.chapterId === sourceChapter.id,
      ).length;

      await this.nativeArchiveImportRepository.updateChapterLessonCount(
        targetChapterId,
        lessonCount,
      );
    }
  }
}
