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
      if (await this.findExistingImport(parsed)) return this.createAlreadyExistsResult(parsed);

      const plan = await this.prepareImportPlan(parsed);
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
          plan.learningPath,
        );
        return {
          kind: parsed.manifest.kind,
          rootId: parsed.manifest.rootId,
          alreadyExists: false,
          createdCourseIds,
          reusedCourseIds: plan.reusedCourseIds,
        };
      } catch (error) {
        await staged.deleteStaged();

        await this.deleteUncommittedCopiedFiles(plan.missing, actor.tenantId);

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

  private async findExistingImport(parsed: ParsedNativeArchive): Promise<boolean> {
    if (parsed.manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH) {
      return Boolean(
        await this.nativeArchiveImportRepository.findLearningPathById(parsed.manifest.rootId),
      );
    }

    return Boolean(
      await this.masterCourseRepository.findCourseByIdInTenant(parsed.manifest.rootId),
    );
  }

  private createAlreadyExistsResult(parsed: ParsedNativeArchive): NativeArchiveImportResult {
    return {
      kind: parsed.manifest.kind,
      rootId: parsed.manifest.rootId,
      alreadyExists: true,
      createdCourseIds: [],
      reusedCourseIds: [],
    };
  }

  private async prepareImportPlan(parsed: ParsedNativeArchive): Promise<NativeArchiveImportPlan> {
    const missing: NativeArchiveValidatedCourseSnapshot[] = [];
    const reusedCourseIds: UUIDType[] = [];

    for (const id of parsed.manifest.courseIds) {
      const snapshot = this.nativeArchiveValidationService.validateCourseSnapshot(
        parsed.courses[id],
      );
      if (snapshot.course.id !== id) {
        throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");
      }

      if (await this.masterCourseRepository.findCourseByIdInTenant(id)) {
        reusedCourseIds.push(id);
      } else {
        missing.push(snapshot);
      }
    }

    const learningPath = this.nativeArchiveValidationService.validateLearningPathSnapshot(
      parsed.learningPath,
      parsed.manifest.kind,
      parsed.manifest.rootId,
      parsed.manifest.courseIds,
    );
    this.nativeArchiveValidationService.assertRequiredAssetsPresent(parsed, missing, learningPath);
    return { missing, reusedCourseIds, learningPath };
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
    learningPath?: NativeArchiveLearningPathImportSnapshot,
  ): Promise<UUIDType[]> {
    return this.tenantDbRunnerService.transaction(async () => {
      const createdCourseIds: UUIDType[] = [];
      for (const snapshot of staged.snapshots) {
        createdCourseIds.push(await this.createImportedCourse(snapshot, actor));
      }

      if (parsed.manifest.kind === NATIVE_ARCHIVE_KIND.LEARNING_PATH) {
        if (!learningPath) throw new BadRequestException("nativeArchive.error.invalidLearningPath");
        await this.createImportedLearningPath(parsed, actor, staged, learningPath);
      }

      return createdCourseIds;
    });
  }

  private async createImportedCourse(
    snapshot: NativeArchiveValidatedCourseSnapshot,
    actor: CurrentUserType,
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
      buildNativeArchiveCourseInsert(source, actor.userId, categoryId),
    );
    await this.masterCourseRepository.ensureCourseSummaryStats(source.id, actor.userId);

    const maps = await this.masterCourseService.duplicateCourseIntoExistingCourse({
      sourceCourseId: source.id,
      targetCourseId: source.id,
      actorId: actor.userId,
      tenantId: actor.tenantId,
      sourceSnapshot: snapshot,
      targetCategoryId: categoryId,
      targetCurrency: NATIVE_ARCHIVE_DEFAULT_CURRENCY,
    });
    await this.nativeArchiveLiveTrainingService.restoreLiveTrainingLessons(
      snapshot,
      maps.chapterMap,
      actor,
    );
    return source.id;
  }

  private async createImportedLearningPath(
    parsed: ParsedNativeArchive,
    actor: CurrentUserType,
    staged: NativeArchiveStagedAssets,
    learningPath: NativeArchiveLearningPathImportSnapshot,
  ): Promise<void> {
    const { courseLinks } = learningPath;
    const insert = buildNativeArchiveLearningPathInsert(
      learningPath,
      actor.userId,
      staged.rewriteReference(learningPath.thumbnailReference),
      staged.rewriteValue(learningPath.settings),
    );
    await this.nativeArchiveImportRepository.createLearningPath(insert);
    if (!courseLinks.length) return;

    await this.nativeArchiveImportRepository.createLearningPathCourses(
      courseLinks.map((link) => ({
        learningPathId: parsed.manifest.rootId,
        courseId: link.courseId,
        displayOrder: link.displayOrder,
      })),
    );
  }

  private async deleteUncommittedCopiedFiles(
    snapshots: SourceSnapshot[],
    tenantId: UUIDType,
  ): Promise<void> {
    const uncommitted: SourceSnapshot[] = [];

    for (const snapshot of snapshots) {
      if (!(await this.masterCourseRepository.findCourseByIdInTenant(snapshot.course.id))) {
        uncommitted.push(snapshot);
      }
    }

    const prefixes = uncommitted.flatMap((snapshot) => [
      prefixTenantStorageKey(`master-course/${snapshot.course.id}/`, tenantId),
      ...snapshot.scormPackages.map((pkg) => {
        const targetPackageId = uuidv5(
          `master-course:${snapshot.course.id}:scorm-package:${pkg.id}`,
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
