import { Injectable, Logger } from "@nestjs/common";

import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";

import { CourseMediaRepository } from "./course-media.repository";

import type { UUIDType } from "src/common";
import type { ImageQuality } from "src/file/image-variants/image-variant.types";

@Injectable()
export class CourseMediaUrlService {
  private readonly logger = new Logger(CourseMediaUrlService.name);

  constructor(
    private readonly courseMediaRepository: CourseMediaRepository,
    private readonly fileService: FileService,
  ) {}

  /** Signed trailer URLs by course ID; a trailer that cannot be signed maps to `null`. */
  async getCourseTrailerUrls(courseIds: UUIDType[]): Promise<Record<string, string | null>> {
    const trailerReferences = await this.courseMediaRepository.findTrailerReferences(courseIds);

    const trailerUrls: Record<UUIDType, string | null> = {};

    await Promise.all(
      trailerReferences.map(async (trailerReference) => {
        try {
          trailerUrls[trailerReference.courseId] = await this.fileService.getFileUrl(
            trailerReference.reference,
          );
        } catch {
          trailerUrls[trailerReference.courseId] = null;
        }
      }),
    );

    return trailerUrls;
  }

  async getCourseTrailerUrl(courseId: UUIDType): Promise<string | null> {
    const trailers = await this.getCourseTrailerUrls([courseId]);
    return trailers[courseId] ?? null;
  }

  /** Falls back to the stored reference when the thumbnail cannot be signed. */
  async getSignedCourseThumbnailUrl(
    thumbnailReference: string | null,
    quality: ImageQuality = IMAGE_QUALITY.XL,
  ): Promise<string | null> {
    if (!thumbnailReference) return thumbnailReference;

    try {
      return await this.fileService.getFileUrl(thumbnailReference, { quality });
    } catch (error) {
      this.logger.error(`Failed to get signed URL for ${thumbnailReference}:`, error);
      return thumbnailReference;
    }
  }
}
