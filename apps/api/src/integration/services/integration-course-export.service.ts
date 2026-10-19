import { Injectable } from "@nestjs/common";

import {
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_KIND,
} from "src/native-archive/native-archive.constants";
import { NativeArchiveJobService } from "src/native-archive/services/native-archive-job.service";

import { assertCanExportTenantCourses } from "../utils/integration-course-access.utils";

import type { IntegrationKeyTenantContext } from "../integration.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FileStreamPayload } from "src/file/types/file-stream.type";
import type {
  NativeArchiveJobReceipt,
  NativeArchiveJobStatus,
} from "src/native-archive/native-archive.types";

/**
 * Exports courses of the tenant selected by X-Tenant-Id as native archives, for external catalogs
 * such as the content marketplace. The key owner lives in the managing tenant, so access is checked
 * here against the key instead of against the owner's roles in the selected tenant.
 */
@Injectable()
export class IntegrationCourseExportService {
  constructor(private readonly nativeArchiveJobService: NativeArchiveJobService) {}

  async startCourseArchiveExport(
    courseId: UUIDType,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<NativeArchiveJobReceipt> {
    assertCanExportTenantCourses(actor, keyTenant);

    return this.nativeArchiveJobService.enqueueArchiveExport(
      NATIVE_ARCHIVE_KIND.COURSE,
      courseId,
      actor,
      NATIVE_ARCHIVE_EXPORT_ACCESS.PRE_AUTHORIZED,
    );
  }

  async getCourseArchiveExportStatus(
    jobId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<NativeArchiveJobStatus> {
    assertCanExportTenantCourses(actor, keyTenant);

    return this.nativeArchiveJobService.getArchiveJobStatus(jobId, actor);
  }

  async getCourseArchiveStream(
    jobId: string,
    actor: CurrentUserType,
    keyTenant: IntegrationKeyTenantContext,
  ): Promise<FileStreamPayload> {
    assertCanExportTenantCourses(actor, keyTenant);

    return this.nativeArchiveJobService.getArchiveDownloadStream(jobId, actor);
  }
}
