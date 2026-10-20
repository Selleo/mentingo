import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { COURSE_ORIGIN_TYPES, LESSON_TYPES, PERMISSIONS } from "@repo/shared";
import { match } from "ts-pattern";
import { v5 as uuidv5 } from "uuid";

import { RagService } from "src/ai/services/rag.service";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { isRecord } from "src/common/utils/object.utils";
import { processInBatches } from "src/common/utils/processInBatches";
import { COURSE_TRANSFER_MODES } from "src/course-transfer/course-transfer.constants";
import { CourseTransferGraphRepository } from "src/course-transfer/repositories/course-transfer-graph.repository";
import { CourseTransferService } from "src/course-transfer/services/course-transfer.service";
import { getTargetScormStorage } from "src/course-transfer/utils/course-transfer-graph.utils";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { getScormPackagePrefix } from "src/scorm/scorm-storage-paths";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { NativeArchiveImportFinishedEvent } from "../events/native-archive-import-finished.event";
import {
  NATIVE_ARCHIVE_DEFAULT_CURRENCY,
  NATIVE_ARCHIVE_IMPORT_MODES,
  NATIVE_ARCHIVE_IMPORT_OUTCOMES,
  NATIVE_ARCHIVE_KIND,
  NATIVE_ARCHIVE_LIMITS,
} from "../native-archive.constants";
import { NativeArchiveImportRepository } from "../repositories/native-archive-import.repository";

import { NativeArchiveAssetsService } from "./native-archive-assets.service";
import {
  buildNativeArchiveCourseInsert,
  buildNativeArchiveLearningPathInsert,
} from "./native-archive-import-inserts";
import { NativeArchiveLiveTrainingService } from "./native-archive-live-training.service";
import { NativeArchiveValidationService } from "./native-archive-validation.service";
import { readNativeArchive } from "./native-archive-zip.service";

import type { NativeArchiveLearningPathImportSnapshot } from "../native-archive-learning-path.types";
import type {
  NativeArchiveImportFinishedReport,
  NativeArchiveImportMode,
  NativeArchiveImportPlan,
  NativeArchiveImportResult,
  NativeArchiveStagedAssets,
  NativeArchiveKind,
  NativeArchiveValidatedCourseSnapshot,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/course-transfer/types/course-transfer-graph.types";

@Injectable()
export class NativeArchiveImportService {
  constructor(
    private readonly nativeArchiveImportRepository: NativeArchiveImportRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly courseTransferGraphRepository: CourseTransferGraphRepository,
    private readonly courseTransferService: CourseTransferService,
    private readonly nativeArchiveAssetsService: NativeArchiveAssetsService,
    private readonly nativeArchiveValidationService: NativeArchiveValidationService,
    private readonly nativeArchiveLiveTrainingService: NativeArchiveLiveTrainingService,
    private readonly settingsService: SettingsService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  /**
   * Imports a native archive. With an import finished report, the IMPORTED outcome is published
   * in the same transaction that commits the imported content, so it is never lost or premature.
   */
  async importArchive(
    zipPath: string,
    actor: CurrentUserType,
    importMode: NativeArchiveImportMode = NATIVE_ARCHIVE_IMPORT_MODES.COPY,
    importFinishedReport?: NativeArchiveImportFinishedReport,
  ): Promise<NativeArchiveImportResult> {
    const parsed = await readNativeArchive(zipPath);

    try {
      await this.assertImportPermissions(parsed, actor);
      if (importMode === NATIVE_ARCHIVE_IMPORT_MODES.SYNC)
        return await this.importSharedCourse(parsed, actor, importFinishedReport);

      const plan = await this.prepareImportPlan(parsed, actor.tenantId);
      if (plan.alreadyExists) {
        if (importFinishedReport)
          await this.tenantDbRunnerService.transactionWithHandle((transaction) =>
            this.publishImportedOutcome(
              importFinishedReport,
              actor,
              this.getImportedCourseId(parsed.manifest.kind, plan.targetRootId),
              transaction,
            ),
          );

        return this.createAlreadyExistsResult(parsed, plan.targetRootId);
      }

      await this.assertLiveTrainingAvailable(plan.missing);
      const staged = await this.nativeArchiveAssetsService.stageArchiveAssets(
        parsed,
        actor,
        plan.missing,
        plan.learningPath,
      );

      try {
        await this.attachEmbeddings(staged.snapshots);
        const createdCourseIds = await this.createImportedRecords(
          parsed,
          actor,
          staged,
          plan,
          plan.learningPath,
          importFinishedReport,
        );
        return {
          kind: parsed.manifest.kind,
          rootId: plan.targetRootId,
          alreadyExists: false,
          createdCourseIds,
          reusedCourseIds: plan.reusedCourseIds,
        };
      } catch (error) {
        await staged.deleteStaged();

        await this.deleteUncommittedCopiedFiles(plan.missing, plan.courseIdMap, actor.tenantId);

        throw error;
      }
    } finally {
      await parsed.cleanup();
    }
  }

  /**
   * Imports a course archive as a read-only shared course. Importing a newer archive of the same
   * course updates that course in place, so its enrollments and learner progress are kept.
   */
  private async importSharedCourse(
    parsed: ParsedNativeArchive,
    actor: CurrentUserType,
    importFinishedReport?: NativeArchiveImportFinishedReport,
  ): Promise<NativeArchiveImportResult> {
    if (parsed.manifest.kind !== NATIVE_ARCHIVE_KIND.COURSE)
      throw new BadRequestException("nativeArchive.error.invalidArchive");

    const snapshot = this.nativeArchiveValidationService.validateCourseSnapshot(
      parsed.courses[parsed.manifest.rootId],
    );
    if (snapshot.course.id !== parsed.manifest.rootId)
      throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");

    const originalId = snapshot.course.originalId ?? snapshot.course.id;
    const existingCourse = await this.nativeArchiveImportRepository.findCourseByArchiveIdentity(
      snapshot.course.id,
      originalId,
      actor.tenantId,
    );
    if (existingCourse && existingCourse.originType !== COURSE_ORIGIN_TYPES.EXPORTED)
      throw new BadRequestException("nativeArchive.error.courseNotSyncable");

    const targetCourseId = existingCourse?.id ?? this.getTargetId(originalId, actor.tenantId);
    if (existingCourse) await this.assertMissingLiveTrainingAvailable(snapshot, targetCourseId);
    else await this.assertLiveTrainingAvailable([snapshot]);
    this.nativeArchiveValidationService.assertRequiredAssetsPresent(parsed, [snapshot]);

    const staged = await this.nativeArchiveAssetsService.stageArchiveAssets(parsed, actor, [
      snapshot,
    ]);

    const [stagedSnapshot] = staged.snapshots;
    if (stagedSnapshot.course.authorMetadata)
      stagedSnapshot.course.authorMetadata = {
        ...stagedSnapshot.course.authorMetadata,
        authorId: actor.userId,
      };

    try {
      await this.attachEmbeddings(staged.snapshots);
      const preparedSync = await this.courseTransferService.prepareArchiveCourseSync({
        source: { tenantId: actor.tenantId, snapshot: stagedSnapshot },
        destination: { tenantId: actor.tenantId, courseId: targetCourseId },
        policy: {
          mode: COURSE_TRANSFER_MODES.ARCHIVE_SYNC,
          actorId: actor.userId,
          uploadedResourceIdsByFileKey: staged.uploadedResourceIdsByFileKey,
        },
      });

      await this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
        if (!existingCourse) {
          const categoryId = await this.resolveImportedCategoryId(stagedSnapshot);

          await this.nativeArchiveImportRepository.createCourse(
            buildNativeArchiveCourseInsert(
              stagedSnapshot.course,
              actor.userId,
              categoryId,
              targetCourseId,
            ),
          );
          await this.courseTransferGraphRepository.ensureCourseSummaryStats(
            targetCourseId,
            actor.userId,
          );
        }

        const { chapterMap } = await this.courseTransferService.syncPreparedArchiveCourse(
          preparedSync,
          transaction,
        );
        await this.nativeArchiveLiveTrainingService.syncLiveTrainingLessons(
          stagedSnapshot,
          chapterMap,
          actor,
          targetCourseId,
          transaction,
        );
        await this.publishImportedOutcome(importFinishedReport, actor, targetCourseId, transaction);
      });
    } catch (error) {
      await staged.deleteStaged();
      if (!existingCourse)
        await this.deleteUncommittedCopiedFiles(
          [snapshot],
          new Map([[snapshot.course.id, targetCourseId]]),
          actor.tenantId,
        );

      throw error;
    }

    return {
      kind: parsed.manifest.kind,
      rootId: targetCourseId,
      alreadyExists: Boolean(existingCourse),
      createdCourseIds: existingCourse ? [] : [targetCourseId],
      reusedCourseIds: [],
    };
  }

  private async publishImportedOutcome(
    importFinishedReport: NativeArchiveImportFinishedReport | undefined,
    actor: CurrentUserType,
    courseId: UUIDType | null,
    transaction?: DatabasePg,
  ): Promise<void> {
    if (!importFinishedReport) return;

    await this.outboxPublisher.publishDurable(
      new NativeArchiveImportFinishedEvent(
        actor.tenantId,
        importFinishedReport.jobId,
        actor.userId,
        NATIVE_ARCHIVE_IMPORT_OUTCOMES.IMPORTED,
        courseId,
        null,
        importFinishedReport.importSource,
        new Date().toISOString(),
      ),
      transaction,
    );
  }

  private getImportedCourseId(kind: NativeArchiveKind, rootId: UUIDType): UUIDType | null {
    return match(kind)
      .with(NATIVE_ARCHIVE_KIND.COURSE, () => rootId)
      .with(NATIVE_ARCHIVE_KIND.LEARNING_PATH, () => null)
      .exhaustive();
  }

  private async assertImportPermissions(parsed: ParsedNativeArchive, actor: CurrentUserType) {
    if (!(await this.hasCurrentPermission(actor, PERMISSIONS.COURSE_CREATE))) {
      throw new ForbiddenException("nativeArchive.error.createAccessRequired");
    }

    if (
      parsed.manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH &&
      !(await this.hasCurrentPermission(actor, PERMISSIONS.LEARNING_PATH_CREATE))
    ) {
      throw new ForbiddenException("nativeArchive.error.createAccessRequired");
    }
  }

  private createAlreadyExistsResult(
    parsed: ParsedNativeArchive,
    targetRootId: UUIDType,
  ): NativeArchiveImportResult {
    return {
      kind: parsed.manifest.kind,
      rootId: targetRootId,
      alreadyExists: true,
      createdCourseIds: [],
      reusedCourseIds: [],
    };
  }

  private async prepareImportPlan(
    parsed: ParsedNativeArchive,
    tenantId: UUIDType,
  ): Promise<NativeArchiveImportPlan> {
    const missing: NativeArchiveValidatedCourseSnapshot[] = [];
    const reusedCourseIds: UUIDType[] = [];
    const courseIdMap = new Map<UUIDType, UUIDType>();
    const snapshots = parsed.manifest.courseIds.map((id) => {
      const snapshot = this.nativeArchiveValidationService.validateCourseSnapshot(
        parsed.courses[id],
      );
      if (snapshot.course.id !== id) {
        throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");
      }
      return snapshot;
    });

    const learningPath = this.nativeArchiveValidationService.validateLearningPathSnapshot(
      parsed.learningPath,
      parsed.manifest.kind,
      parsed.manifest.rootId,
      parsed.manifest.courseIds,
    );

    const sourceRoot = learningPath ?? snapshots[0]?.course;
    if (!sourceRoot) throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");

    const originalRootId = sourceRoot.originalId ?? sourceRoot.id;
    const existingRoot = learningPath
      ? await this.nativeArchiveImportRepository.findLearningPathByArchiveIdentity(
          sourceRoot.id,
          originalRootId,
          tenantId,
        )
      : await this.nativeArchiveImportRepository.findCourseByArchiveIdentity(
          sourceRoot.id,
          originalRootId,
          tenantId,
        );

    if (existingRoot) {
      return {
        missing,
        reusedCourseIds,
        learningPath,
        courseIdMap,
        targetRootId: existingRoot.id,
        alreadyExists: true,
      };
    }

    for (const snapshot of snapshots) {
      const sourceId = snapshot.course.id;
      const originalId = snapshot.course.originalId ?? sourceId;
      const existing = await this.nativeArchiveImportRepository.findCourseByArchiveIdentity(
        sourceId,
        originalId,
        tenantId,
      );

      if (existing) {
        courseIdMap.set(sourceId, existing.id);
        reusedCourseIds.push(existing.id);
      } else {
        courseIdMap.set(sourceId, this.getTargetId(originalId, tenantId));
        missing.push(snapshot);
      }
    }

    this.nativeArchiveValidationService.assertRequiredAssetsPresent(parsed, missing, learningPath);

    const targetRootId = learningPath
      ? this.getTargetId(originalRootId, tenantId)
      : courseIdMap.get(parsed.manifest.rootId);
    if (!targetRootId) throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");

    return {
      missing,
      reusedCourseIds,
      learningPath,
      courseIdMap,
      targetRootId,
      alreadyExists: false,
    };
  }

  private getTargetId(originalId: UUIDType, tenantId: UUIDType): UUIDType {
    return uuidv5(`native-archive:${originalId}`, tenantId);
  }

  private async assertLiveTrainingAvailable(
    snapshots: NativeArchiveValidatedCourseSnapshot[],
  ): Promise<void> {
    const includesLiveTraining = snapshots.some((snapshot) =>
      snapshot.lessons.some((lesson) => lesson.type === LESSON_TYPES.LIVE_TRAINING),
    );
    if (includesLiveTraining) await this.assertLiveTrainingEnabled();
  }

  private async assertMissingLiveTrainingAvailable(
    snapshot: NativeArchiveValidatedCourseSnapshot,
    targetCourseId: UUIDType,
  ): Promise<void> {
    const restoresLiveTraining = await this.tenantDbRunnerService.transactionWithHandle(
      (transaction) =>
        this.nativeArchiveLiveTrainingService.hasLiveTrainingLessonsToRestore(
          snapshot,
          targetCourseId,
          transaction,
        ),
    );

    if (restoresLiveTraining) await this.assertLiveTrainingEnabled();
  }

  private async assertLiveTrainingEnabled(): Promise<void> {
    if (!(await this.settingsService.getGlobalSettings()).liveTrainingEnabled) {
      throw new BadRequestException("nativeArchive.error.liveTrainingUnavailable");
    }
  }

  private async attachEmbeddings(snapshots: NativeArchiveValidatedCourseSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      const chunks = snapshot.aiMentorDocChunks;
      if (!chunks.length) continue;

      const embeddings = await this.ragService.getEmbeddings(chunks.map((chunk) => chunk.content));
      if (embeddings.length !== chunks.length) {
        throw new BadRequestException("nativeArchive.error.embeddingUnavailable");
      }
      chunks.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });
    }
  }

  private createImportedRecords(
    parsed: ParsedNativeArchive,
    actor: CurrentUserType,
    staged: NativeArchiveStagedAssets,
    plan: NativeArchiveImportPlan,
    learningPath?: NativeArchiveLearningPathImportSnapshot,
    importFinishedReport?: NativeArchiveImportFinishedReport,
  ): Promise<UUIDType[]> {
    return this.tenantDbRunnerService.transaction(async () => {
      const createdCourseIds: UUIDType[] = [];
      for (const snapshot of staged.snapshots) {
        const targetCourseId = plan.courseIdMap.get(snapshot.course.id);
        if (!targetCourseId)
          throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");
        createdCourseIds.push(
          await this.createImportedCourse(snapshot, targetCourseId, actor, staged),
        );
      }

      if (parsed.manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH) {
        if (!learningPath) throw new BadRequestException("nativeArchive.error.invalidLearningPath");
        await this.createImportedLearningPath(
          actor,
          staged,
          learningPath,
          plan.targetRootId,
          plan.courseIdMap,
        );
      }

      await this.publishImportedOutcome(
        importFinishedReport,
        actor,
        this.getImportedCourseId(parsed.manifest.kind, plan.targetRootId),
      );

      return createdCourseIds;
    });
  }

  private async createImportedCourse(
    snapshot: NativeArchiveValidatedCourseSnapshot,
    targetCourseId: UUIDType,
    actor: CurrentUserType,
    staged: NativeArchiveStagedAssets,
  ): Promise<UUIDType> {
    const source = snapshot.course;
    if (source.authorMetadata)
      source.authorMetadata = { ...source.authorMetadata, authorId: actor.userId };

    const categoryId = await this.resolveImportedCategoryId(snapshot);

    await this.nativeArchiveImportRepository.createCourse(
      buildNativeArchiveCourseInsert(source, actor.userId, categoryId, targetCourseId),
    );
    await this.courseTransferGraphRepository.ensureCourseSummaryStats(targetCourseId, actor.userId);

    const maps = await this.courseTransferService.copyCourseIntoExistingCourse({
      source: { tenantId: actor.tenantId, snapshot },
      destination: { tenantId: actor.tenantId, courseId: targetCourseId },
      policy: {
        mode: COURSE_TRANSFER_MODES.DUPLICATE,
        actorId: actor.userId,
        targetCategoryId: categoryId,
        targetCurrency: NATIVE_ARCHIVE_DEFAULT_CURRENCY,
        uploadedResourceIdsByFileKey: staged.uploadedResourceIdsByFileKey,
      },
    });
    await this.nativeArchiveLiveTrainingService.restoreLiveTrainingLessons(
      snapshot,
      maps.chapterMap,
      actor,
      targetCourseId,
    );
    return targetCourseId;
  }

  private async resolveImportedCategoryId(
    snapshot: NativeArchiveValidatedCourseSnapshot,
  ): Promise<UUIDType> {
    const categoryTitle = snapshot.category.title[snapshot.category.baseLanguage];
    if (typeof categoryTitle !== "string" || !categoryTitle) {
      throw new BadRequestException("nativeArchive.error.invalidCategory");
    }

    const existingCategory = await this.courseTransferGraphRepository.findCategoryByBaseTitle(
      categoryTitle,
      snapshot.category.baseLanguage,
    );
    const categoryId =
      existingCategory?.id ??
      (
        await this.courseTransferGraphRepository.createCategoryFromSource({
          title: buildJsonbFieldWithMultipleEntries(snapshot.category.title),
          baseLanguage: snapshot.category.baseLanguage,
          availableLocales: snapshot.category.availableLocales,
        })
      )?.id;
    if (!categoryId) throw new BadRequestException("nativeArchive.error.categoryCreationFailed");

    return categoryId;
  }

  private async createImportedLearningPath(
    actor: CurrentUserType,
    staged: NativeArchiveStagedAssets,
    learningPath: NativeArchiveLearningPathImportSnapshot,
    targetPathId: UUIDType,
    courseIdMap: ReadonlyMap<UUIDType, UUIDType>,
  ): Promise<void> {
    const { courseLinks } = learningPath;
    const insert = buildNativeArchiveLearningPathInsert(
      learningPath,
      actor.userId,
      staged.rewriteReference(learningPath.thumbnailReference),
      staged.rewriteValue(learningPath.settings),
      targetPathId,
    );
    await this.nativeArchiveImportRepository.createLearningPath(insert);
    if (!courseLinks.length) return;

    await this.nativeArchiveImportRepository.createLearningPathCourses(
      courseLinks.map((link) => ({
        learningPathId: targetPathId,
        courseId: this.getMappedCourseId(courseIdMap, link.courseId),
        displayOrder: link.displayOrder,
      })),
    );
  }

  private getMappedCourseId(
    courseIdMap: ReadonlyMap<UUIDType, UUIDType>,
    sourceId: UUIDType,
  ): UUIDType {
    const targetId = courseIdMap.get(sourceId);
    if (!targetId) throw new BadRequestException("nativeArchive.error.invalidLearningPath");
    return targetId;
  }

  private async deleteUncommittedCopiedFiles(
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    courseIdMap: ReadonlyMap<UUIDType, UUIDType>,
    tenantId: UUIDType,
  ): Promise<void> {
    const uncommitted: { snapshot: SourceSnapshot; targetId: UUIDType }[] = [];

    for (const snapshot of snapshots) {
      const targetId = courseIdMap.get(snapshot.course.id);
      if (
        targetId &&
        !(await this.courseTransferGraphRepository.findCourseByIdInTenant(targetId))
      ) {
        uncommitted.push({ snapshot, targetId });
      }
    }

    const prefixes = uncommitted.flatMap(({ snapshot, targetId }) => [
      prefixTenantStorageKey(`master-course/${targetId}/`, tenantId),
      ...snapshot.scormPackages.map((pkg) => {
        const { targetPackageId } = getTargetScormStorage(targetId, tenantId, pkg);
        return `${getScormPackagePrefix(tenantId, targetPackageId)}/`;
      }),
    ]);

    for (const prefix of prefixes) {
      const keys = await this.s3Service.listFileKeysByPrefix(prefix).catch(() => []);

      await processInBatches(keys, (key) => this.s3Service.deleteFile(key), {
        batchSize: NATIVE_ARCHIVE_LIMITS.ASSET_CLEANUP_BATCH_SIZE,
        throwOnError: false,
      });
    }
  }

  async dismissImportedLiveTrainingReview(id: UUIDType, actor: CurrentUserType): Promise<void> {
    const training = await this.nativeArchiveImportRepository.findLiveTrainingById(id);

    if (!training) throw new BadRequestException("nativeArchive.error.liveTrainingNotFound");

    const canManage =
      (await this.hasCurrentPermission(actor, PERMISSIONS.LIVE_TRAINING_UPDATE)) ||
      ((await this.hasCurrentPermission(actor, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)) &&
        training.authorId === actor.userId);

    if (!canManage) throw new ForbiddenException("nativeArchive.error.accessDenied");

    await this.nativeArchiveImportRepository.updateLiveTrainingMetadata(id, {
      ...(isRecord(training.metadata) ? training.metadata : {}),
      nativeArchiveReviewRequired: false,
    });
  }

  private async hasCurrentPermission(
    actor: CurrentUserType,
    permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  ) {
    return Boolean(
      (await this.nativeArchiveImportRepository.findUserPermission(actor.userId, permission))
        ?.allowed,
    );
  }
}
