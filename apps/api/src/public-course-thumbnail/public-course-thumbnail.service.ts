import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { courses } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class PublicCourseThumbnailService {
  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly fileService: FileService,
  ) {}

  async resolveSignedUrl(courseId: UUIDType, tenantId: UUIDType): Promise<string | null> {
    const [course] = await this.dbAdmin
      .select({ thumbnailS3Key: courses.thumbnailS3Key })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
      .limit(1);

    if (!course) return null;

    if (!course.thumbnailS3Key) return null;

    return this.fileService.getFileUrl(course.thumbnailS3Key);
  }
}
