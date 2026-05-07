import { ForbiddenException, Injectable } from "@nestjs/common";
import { buildScormExportCourseJson, buildScormExportPackage } from "@repo/scorm-export-generator";
import slugify from "slugify";

import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";

import { CourseScormAssetsService } from "./course-scorm-assets.service";
import { CourseScormSnapshotService } from "./course-scorm-snapshot.service";

import type { SupportedLanguages } from "@repo/shared";
import type { Readable } from "node:stream";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const SCORM_EXPORT_CONTENT_TYPE = "application/zip";
const SCORM_EXPORT_FILENAME_VERSION = "scorm-1-2";

export type CourseScormExportResult = {
  stream: Readable;
  filename: string;
  contentType: string;
};

@Injectable()
export class CourseScormExportService {
  constructor(
    private readonly snapshotService: CourseScormSnapshotService,
    private readonly assetsService: CourseScormAssetsService,
  ) {}

  async exportCourse(
    courseId: UUIDType,
    actor: CurrentUserType,
    language?: SupportedLanguages,
    tenantOrigin?: string | null,
  ): Promise<CourseScormExportResult> {
    const { snapshot, authorId } = await this.snapshotService.buildSnapshot(courseId, language);

    if (!canUpdateCourseByAuthor(actor, authorId)) {
      throw new ForbiddenException("adminCourseView.scormExport.error.accessDenied");
    }

    const assetCollection = await this.assetsService.collectAssets(snapshot, { tenantOrigin });

    const { stream } = buildScormExportPackage({
      courseJson: buildScormExportCourseJson(assetCollection.snapshot),
      files: assetCollection.files,
    });

    return {
      stream,
      filename: this.buildFilename(assetCollection.snapshot.title, assetCollection.snapshot.id),
      contentType: SCORM_EXPORT_CONTENT_TYPE,
    };
  }

  private buildFilename(title: string, courseId: UUIDType) {
    const slug = slugify(title, { lower: true, strict: true }) || "course";
    return `${slug}-${courseId}-${SCORM_EXPORT_FILENAME_VERSION}.zip`;
  }
}
