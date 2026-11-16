import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { buildScormExportCourseJson, buildScormExportPackage } from "@repo/scorm-export-generator";

import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";

import { CourseScormAssetsService } from "./course-scorm-assets.service";
import {
  buildScormExportFilename,
  fingerprintScormExportSnapshot,
  stagePackageFiles,
} from "./course-scorm-export.utils";
import { CourseScormSnapshotRepository } from "./course-scorm-snapshot.repository";
import { CourseScormSnapshotService } from "./course-scorm-snapshot.service";

import type {
  CourseScormBuildPackageOptions,
  CourseScormBuiltPackage,
  CourseScormPreparedExport,
} from "./course-scorm-export.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseScormExportService {
  constructor(
    private readonly snapshotService: CourseScormSnapshotService,
    private readonly snapshotRepository: CourseScormSnapshotRepository,
    private readonly assetsService: CourseScormAssetsService,
  ) {}

  async assertCanExport(courseId: UUIDType, actor: CurrentUserType) {
    const authorId = await this.snapshotRepository.findCourseAuthorId(courseId);

    if (!authorId) throw new NotFoundException("adminCourseView.scormExport.error.courseNotFound");

    if (!canUpdateCourseByAuthor(actor, authorId)) {
      throw new ForbiddenException("adminCourseView.scormExport.error.accessDenied");
    }
  }

  async prepareExport(
    courseId: UUIDType,
    actor: CurrentUserType,
    language?: SupportedLanguages,
  ): Promise<CourseScormPreparedExport> {
    const { snapshot, authorId } = await this.snapshotService.buildSnapshot(courseId, language);

    if (!canUpdateCourseByAuthor(actor, authorId)) {
      throw new ForbiddenException("adminCourseView.scormExport.error.accessDenied");
    }

    return {
      snapshot,
      fingerprint: fingerprintScormExportSnapshot(snapshot),
      filename: buildScormExportFilename(snapshot.title),
    };
  }

  async buildPackage(
    { snapshot }: CourseScormPreparedExport,
    { tenantOrigin, onFileStaged }: CourseScormBuildPackageOptions = {},
  ): Promise<CourseScormBuiltPackage> {
    const directory = await mkdtemp(path.join(tmpdir(), "mentingo-scorm-export-"));
    const cleanup = () => rm(directory, { recursive: true, force: true });

    try {
      const assetCollection = await this.assetsService.collectAssets(snapshot, { tenantOrigin });
      const stagedFiles = await stagePackageFiles(assetCollection.files, directory, onFileStaged);
      const { stream } = buildScormExportPackage({
        courseJson: buildScormExportCourseJson(assetCollection.snapshot),
        files: stagedFiles.map((file) => ({
          path: file.path,
          streamFactory: async () => createReadStream(file.stagedFilePath),
        })),
      });

      return {
        stream,
        estimatedByteLength: stagedFiles.reduce((total, file) => total + file.byteLength, 0),
        cleanup,
      };
    } catch (error) {
      await cleanup();
      throw error;
    }
  }
}
