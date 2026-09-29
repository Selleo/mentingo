import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { LESSON_TYPES, PERMISSIONS } from "@repo/shared";
import { v5 as uuidv5 } from "uuid";

import { RagService } from "src/ai/services/rag.service";
import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { isRecord } from "src/common/utils/object.utils";
import { processInBatches } from "src/common/utils/processInBatches";
import { SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE } from "src/courses/master-course-scorm.constants";
import { MasterCourseRepository } from "src/courses/master-course.repository";
import { MasterCourseService } from "src/courses/master-course.service";
import { prefixTenantStorageKey } from "src/file/utils/tenantStorageKey";
import { S3Service } from "src/s3/s3.service";
import { getScormPackagePrefix } from "src/scorm/scorm-storage-paths";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  NATIVE_ARCHIVE_DEFAULT_CURRENCY,
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
  NativeArchiveImportPlan,
  NativeArchiveImportResult,
  NativeArchiveStagedAssets,
  NativeArchiveValidatedCourseSnapshot,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

@Injectable()
export class NativeArchiveImportService {
  constructor(
    private readonly nativeArchiveImportRepository: NativeArchiveImportRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly masterCourseRepository: MasterCourseRepository,
    private readonly masterCourseService: MasterCourseService,
    private readonly nativeArchiveAssetsService: NativeArchiveAssetsService,
    private readonly nativeArchiveValidationService: NativeArchiveValidationService,
    private readonly nativeArchiveLiveTrainingService: NativeArchiveLiveTrainingService,
    private readonly settingsService: SettingsService,
    private readonly ragService: RagService,
    private readonly s3Service: S3Service,
  ) {}

  async importArchive(zipPath: string, actor: CurrentUserType): Promise<NativeArchiveImportResult> {
    const parsed = await readNativeArchive(zipPath);

    try {
      await this.assertImportPermissions(parsed, actor);
      const plan = await this.prepareImportPlan(parsed, actor.tenantId);
      if (plan.alreadyExists) return this.createAlreadyExistsResult(parsed, plan.targetRootId);

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

        await this.deleteUncommittedCopiedFiles(plan, actor.tenantId);

        throw error;
      }
    } finally {
      await parsed.cleanup();
    }
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
    if (
      includesLiveTraining &&
      !(await this.settingsService.getGlobalSettings()).liveTrainingEnabled
    ) {
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

    const categoryTitle = snapshot.category.title[snapshot.category.baseLanguage];
    if (typeof categoryTitle !== "string" || !categoryTitle) {
      throw new BadRequestException("nativeArchive.error.invalidCategory");
    }

    const existingCategory = await this.masterCourseRepository.findCategoryByBaseTitle(
      categoryTitle,
      snapshot.category.baseLanguage,
    );
    const categoryId =
      existingCategory?.id ??
      (
        await this.masterCourseRepository.createCategoryFromSource({
          title: buildJsonbFieldWithMultipleEntries(snapshot.category.title),
          baseLanguage: snapshot.category.baseLanguage,
          availableLocales: snapshot.category.availableLocales,
        })
      )?.id;
    if (!categoryId) throw new BadRequestException("nativeArchive.error.categoryCreationFailed");

    await this.nativeArchiveImportRepository.createCourse(
      buildNativeArchiveCourseInsert(source, actor.userId, categoryId, targetCourseId),
    );
    await this.masterCourseRepository.ensureCourseSummaryStats(targetCourseId, actor.userId);

    const maps = await this.masterCourseService.duplicateCourseIntoExistingCourse({
      sourceCourseId: source.id,
      targetCourseId,
      actorId: actor.userId,
      tenantId: actor.tenantId,
      sourceSnapshot: snapshot,
      targetCategoryId: categoryId,
      targetCurrency: NATIVE_ARCHIVE_DEFAULT_CURRENCY,
      uploadedResourceIdsByFileKey: staged.uploadedResourceIdsByFileKey,
    });
    await this.nativeArchiveLiveTrainingService.restoreLiveTrainingLessons(
      snapshot,
      maps.chapterMap,
      actor,
      targetCourseId,
    );
    return targetCourseId;
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
    plan: NativeArchiveImportPlan,
    tenantId: UUIDType,
  ): Promise<void> {
    const uncommitted: { snapshot: SourceSnapshot; targetId: UUIDType }[] = [];

    for (const snapshot of plan.missing) {
      const targetId = plan.courseIdMap.get(snapshot.course.id);
      if (targetId && !(await this.masterCourseRepository.findCourseByIdInTenant(targetId))) {
        uncommitted.push({ snapshot, targetId });
      }
    }

    const prefixes = uncommitted.flatMap(({ snapshot, targetId }) => [
      prefixTenantStorageKey(`master-course/${targetId}/`, tenantId),
      ...snapshot.scormPackages.map((pkg) => {
        const targetPackageId = uuidv5(
          `master-course:${targetId}:scorm-package:${pkg.id}`,
          SCORM_MASTER_COURSE_PACKAGE_UUID_NAMESPACE,
        );

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
