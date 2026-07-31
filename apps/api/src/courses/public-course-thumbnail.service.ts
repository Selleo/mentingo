import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { courses } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class PublicCourseThumbnailService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly fileService: FileService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async resolveSignedUrl(courseId: UUIDType, tenantId: UUIDType): Promise<string | null> {
    const course = await this.tenantRunner.runWithTenant(tenantId, async () => {
      const [row] = await this.db
        .select({ thumbnailS3Key: courses.thumbnailS3Key })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      return row;
    });

    if (!course) return null;

    if (!course.thumbnailS3Key) return null;

    return this.fileService.getFileUrl(course.thumbnailS3Key);
  }
}
